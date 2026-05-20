"""
Crew payout queue for support: list pending/processing payouts, unpaid earnings,
create payouts from earnings, and mark payouts completed after bank transfer.

Crew cannot self-initiate payouts; support bundles pending earnings and records payment.

**Auth:** :class:`SupportPermissionAccess` — ``X-Support-Internal-Key`` from support server.

**Actions:**
- ``GET get_payout_queue`` — pending/processing (or filtered) payout rows
- ``GET get_crew_payout_detail`` — single payout by ``payout_id``
- ``GET get_crew_unpaid_earnings`` — aggregated unpaid totals per crew member
- ``GET get_crew_unpaid_earnings_detail`` — per-job earnings + masked bank account
- ``POST mark_payout_paid`` — complete an existing payout after transfer
- ``POST create_crew_payout`` — create pending payout from unpaid earnings
- ``POST record_crew_payment_made`` — create payout and mark completed in one step
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from main.models import BankAccount, Detailer, Earning, PayoutHistory
from main.utils.pii_encryption import mask_iban
from main.views.support.support_permission_access import SupportPermissionAccess

logger = logging.getLogger(__name__)


def _fmt_display_date(dt) -> str:
    """Human-readable date for support UI (``%d %b %Y``); safe for ``date`` and ``datetime``."""
    if not dt:
        return ""
    # Period bounds are datetime.date; is_aware() calls utcoffset() and crashes on date.
    if isinstance(dt, date) and not isinstance(dt, datetime):
        return dt.strftime("%d %b %Y")
    if timezone.is_aware(dt):
        dt = timezone.localtime(dt)
    return dt.strftime("%d %b %Y")


def _iso(dt) -> str:
    """ISO-8601 string for API payloads; empty string if falsy."""
    if not dt:
        return ""
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def _earning_period_bounds(payout: PayoutHistory) -> tuple:
    """Return (period_start, period_end) dates for a payout, with safe fallbacks."""
    earnings = payout.earnings.all().order_by("created_at")
    fallback = payout.created_at.date() if payout.created_at else None
    if not earnings.exists():
        return fallback, fallback
    first = earnings.first()
    last = earnings.last()
    start = first.created_at.date() if first and first.created_at else fallback
    end = last.created_at.date() if last and last.created_at else fallback
    return start, end


def _serialize_crew_payout(payout: PayoutHistory) -> dict:
    """Serialize a :class:`PayoutHistory` row for the support payout queue UI."""
    detailer = payout.detailer
    user = detailer.user if detailer else None
    period_start, period_end = _earning_period_bounds(payout)
    pay_label = "Scheduled" if payout.payment_type == "scheduled" else "Request"
    return {
        "id": str(payout.id),
        "crew_member_id": str(detailer.id) if detailer else None,
        "crew_member_name": user.get_full_name() if user else "",
        "crew_member_email": user.email if user else "",
        "amount": float(payout.payout_amount),
        "status": payout.status,
        "payment_type": payout.payment_type,
        "pay_frequency_label": pay_label,
        "period_start": period_start.isoformat() if period_start else "",
        "period_end": period_end.isoformat() if period_end else "",
        "period_start_display": _fmt_display_date(period_start),
        "period_end_display": _fmt_display_date(period_end),
        "requested_at": _iso(payout.initiated_at),
        "requested_at_display": _fmt_display_date(payout.initiated_at),
        "paid_at": _iso(payout.completed_at),
        "paid_at_display": _fmt_display_date(payout.completed_at),
        "admin_notes": payout.failure_reason or "",
        "payout_reference": payout.payout_reference or "",
    }


def _resolve_bank_account_for_detailer(detailer: Detailer) -> BankAccount | None:
    """Resolve the bank account support should use for payouts.

    The crew app lists accounts by user (``detailer__user``), while unpaid earnings
    are keyed by ``detailer_id``. When those differ, only searching the earning's
    detailer row misses accounts the crew member already added.
    """
    if not detailer:
        return None

    qs = BankAccount.objects.filter(detailer=detailer)
    user_id = getattr(detailer, "user_id", None)
    if user_id:
        qs = BankAccount.objects.filter(Q(detailer=detailer) | Q(detailer__user_id=user_id))

    # Prefer primary accounts with a usable IBAN, then any account with IBAN.
    with_iban = qs.exclude(iban="").order_by("-is_primary", "-created_at")
    return with_iban.first() or qs.order_by("-is_primary", "-created_at").first()


def _serialize_bank_account(detailer: Detailer) -> dict:
    """Bank account summary for support; IBAN is always masked (never full value in API)."""
    bank_account = _resolve_bank_account_for_detailer(detailer)
    if not bank_account:
        return {
            "has_bank_account": False,
            "account_name": "",
            "iban_masked": "",
        }
    # IBAN masking: only last four digits exposed; full IBAN stays in DB encrypted/plain per model.
    iban_masked = mask_iban(bank_account.iban)
    return {
        "has_bank_account": True,
        "account_name": bank_account.account_name or "",
        "iban_masked": iban_masked,
        "is_primary": bank_account.is_primary,
        "is_verified": bank_account.is_verified,
    }


def _serialize_unpaid_earning(earning: Earning) -> dict:
    """Single pending earning line for crew unpaid-earnings detail."""
    job = earning.job
    return {
        "id": str(earning.id),
        "job_id": str(job.id) if job else None,
        "job_reference": job.booking_reference if job else "",
        "client_name": job.client_name if job else "",
        "service_type": job.service_type.name if (job and job.service_type_id) else "",
        "gross_amount": float(earning.gross_amount or 0),
        "net_amount": float(earning.net_amount or 0),
        "total_active_hours": float(earning.total_active_hours or 0),
        "total_inactive_hours": float(earning.total_inactive_hours or 0),
        "created_at": earning.created_at.isoformat() if earning.created_at else "",
        "created_at_display": _fmt_display_date(earning.created_at),
    }


class SupportPayoutsView(APIView):
    """Support crew payout queue, unpaid earnings, and post-transfer completion.

    Detailer JWT authentication is disabled; only :class:`SupportPermissionAccess` applies.
    """

    authentication_classes = ()
    permission_classes = [SupportPermissionAccess]

    get_action_handler = {
        "get_payout_queue": "_get_payout_queue",
        "get_crew_payout_detail": "_get_crew_payout_detail",
        "get_crew_unpaid_earnings": "_get_crew_unpaid_earnings",
        "get_crew_unpaid_earnings_detail": "_get_crew_unpaid_earnings_detail",
    }
    post_action_handler = {
        "mark_payout_paid": "_post_mark_payout_paid",
        "create_crew_payout": "_post_create_crew_payout",
        "record_crew_payment_made": "_post_record_crew_payment_made",
    }

    def get(self, request, *args, **kwargs):
        """Dispatch GET ``action`` to queue, detail, or unpaid-earnings handlers."""
        action = kwargs.get("action")
        if action not in self.get_action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        return getattr(self, self.get_action_handler[action])(request, **kwargs)

    def post(self, request, *args, **kwargs):
        """Dispatch POST ``action`` to mark-paid, create, or record-payment handlers."""
        action = kwargs.get("action")
        if action not in self.post_action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        return getattr(self, self.post_action_handler[action])(request, **kwargs)

    def _get_payout_queue(self, request, **kwargs):
        """List payout requests; default filter is pending + processing."""
        status_filter = (request.query_params.get("status") or "").strip().lower()
        qs = PayoutHistory.objects.select_related(
            "detailer", "detailer__user"
        ).prefetch_related("earnings")
        if status_filter in ("pending", "processing", "completed", "failed", "cancelled"):
            qs = qs.filter(status=status_filter)
            if status_filter == "completed":
                qs = qs.order_by("-completed_at", "-initiated_at")
            else:
                qs = qs.order_by("-initiated_at")
        else:
            qs = qs.filter(status__in=["pending", "processing"]).order_by("-initiated_at")
        rows = [_serialize_crew_payout(p) for p in qs[:100]]
        return Response({"data": {"payout_requests": rows}}, status=status.HTTP_200_OK)

    def _get_crew_payout_detail(self, request, **kwargs):
        """Return one payout row by ``payout_id`` query param."""
        payout_id = (request.query_params.get("payout_id") or "").strip()
        if not payout_id:
            return Response({"error": "payout_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payout = (
                PayoutHistory.objects.select_related("detailer", "detailer__user")
                .prefetch_related("earnings")
                .get(pk=payout_id)
            )
        except PayoutHistory.DoesNotExist:
            return Response({"error": "Payout not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": {"payout": _serialize_crew_payout(payout)}}, status=status.HTTP_200_OK)

    def _post_mark_payout_paid(self, request, **kwargs):
        """Mark an existing pending/processing payout completed after bank transfer."""
        data = request.data if hasattr(request.data, "get") else {}
        payout_id = (data.get("payout_request_id") or data.get("payout_id") or "").strip()
        payment_reference = (data.get("payment_reference") or "").strip()
        admin_notes = (data.get("admin_notes") or "").strip()

        if not payout_id:
            return Response({"error": "payout_request_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payout = PayoutHistory.objects.select_related("detailer").get(pk=payout_id)
        except PayoutHistory.DoesNotExist:
            return Response({"error": "Payout not found"}, status=status.HTTP_404_NOT_FOUND)

        if payout.status == "completed":
            return Response(
                {"data": {"message": "Already paid", "payout": _serialize_crew_payout(payout)}},
                status=status.HTTP_200_OK,
            )

        if payout.status not in ("pending", "processing"):
            return Response(
                {"error": f"Cannot mark {payout.status} payout as paid"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if payment_reference and not payout.payout_reference:
                payout.payout_reference = payment_reference
            if admin_notes and payment_reference:
                payout.external_transaction_id = f"{payment_reference} | {admin_notes}"[:100]
            elif payment_reference:
                payout.external_transaction_id = payment_reference[:100]
            # Payout marking: completes payout and marks linked earnings paid via model helper.
            payout.mark_as_completed(external_transaction_id=payout.external_transaction_id or None)

        logger.info(
            "Support crew payout marked paid: id=%s crew=%s amount=%s",
            payout_id,
            payout.detailer_id,
            payout.payout_amount,
        )
        return Response(
            {"data": {"message": "Payout marked as paid", "payout": _serialize_crew_payout(payout)}},
            status=status.HTTP_200_OK,
        )

    def _get_crew_unpaid_earnings(self, request, **kwargs):
        """Return aggregated unpaid earnings per crew member.

        Earnings counted are those with ``payment_status='pending'`` and not already
        linked to an existing in-flight (pending/processing) ``PayoutHistory``.
        """
        crew_id_filter = (request.query_params.get("crew_member_id") or "").strip()

        earnings_qs = Earning.objects.select_related(
            "detailer", "detailer__user", "job", "job__service_type"
        ).filter(payment_status="pending")

        in_flight_earning_ids = set(
            PayoutHistory.objects.filter(status__in=["pending", "processing"])
            .values_list("earnings__id", flat=True)
        )
        in_flight_earning_ids.discard(None)
        if in_flight_earning_ids:
            earnings_qs = earnings_qs.exclude(id__in=in_flight_earning_ids)

        if crew_id_filter:
            earnings_qs = earnings_qs.filter(detailer_id=crew_id_filter)

        by_detailer: dict[str, list[Earning]] = {}
        detailers: dict[str, Detailer] = {}
        for e in earnings_qs.order_by("-created_at"):
            did = str(e.detailer_id)
            by_detailer.setdefault(did, []).append(e)
            detailers[did] = e.detailer

        rows = []
        for did, items in by_detailer.items():
            detailer = detailers[did]
            user = detailer.user
            unpaid_total = sum((e.net_amount or Decimal("0")) for e in items)
            rows.append(
                {
                    "crew_member_id": did,
                    "crew_member_name": user.get_full_name() if user else "",
                    "crew_member_email": user.email if user else "",
                    "unpaid_amount": float(unpaid_total),
                    "unpaid_job_count": len(items),
                    "latest_earning_at": items[0].created_at.isoformat() if items else "",
                    "latest_earning_at_display": _fmt_display_date(items[0].created_at) if items else "",
                }
            )

        rows.sort(key=lambda r: r["unpaid_amount"], reverse=True)
        return Response({"data": {"crew_unpaid_earnings": rows}}, status=status.HTTP_200_OK)


    def _get_crew_unpaid_earnings_detail(self, request, **kwargs):
        """Return per-job unpaid earnings for a single crew member.

        Includes ``bank_account`` from :func:`_serialize_bank_account`; ``iban_masked`` is
        always masked via :func:`main.utils.pii_encryption.mask_iban` — full IBAN is never
        returned in API responses.
        """
        crew_id = (request.query_params.get("crew_member_id") or "").strip()
        if not crew_id:
            return Response(
                {"error": "crew member id required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            detailer = Detailer.objects.select_related("user").get(pk=crew_id)
        except (Detailer.DoesNotExist, ValueError):
            return Response({"error": "Crew member not found or invalid"}, status=status.HTTP_404_NOT_FOUND)

        in_flight_earning_ids = set(
            PayoutHistory.objects.filter(
                detailer=detailer, status__in=["pending", "processing"]
            ).values_list("earnings__id", flat=True)
        )
        in_flight_earning_ids.discard(None)

        earnings_qs = (
            Earning.objects.select_related("job", "job__service_type")
            .filter(detailer=detailer, payment_status__in=["pending"])
            .order_by("-created_at")
        )
        if in_flight_earning_ids:
            earnings_qs = earnings_qs.exclude(id__in=in_flight_earning_ids)

        user = detailer.user
        unpaid_total = earnings_qs.aggregate(s=Sum("net_amount"))["s"] or Decimal("0")
        items = [_serialize_unpaid_earning(e) for e in earnings_qs]

        return Response(
            {
                "data": {
                    "crew_member_id": str(detailer.id),
                    "crew_member_name": user.get_full_name() if user else "",
                    "crew_member_email": user.email if user else "",
                    "unpaid_amount": float(unpaid_total),
                    "unpaid_job_count": len(items),
                    "earnings": items,
                    "bank_account": _serialize_bank_account(detailer),
                }
            },
            status=status.HTTP_200_OK,
        )

    def _bundle_unpaid_earnings_for_payout(
        self,
        detailer: Detailer,
        raw_earning_ids: list,
    ) -> tuple[list[Earning], Decimal] | tuple[None, Response]:
        """Select pending earnings eligible for a new payout (not already in-flight)."""
        in_flight_earning_ids = set(
            PayoutHistory.objects.filter(
                detailer=detailer, status__in=["pending", "processing"]
            ).values_list("earnings__id", flat=True)
        )
        in_flight_earning_ids.discard(None)

        base_qs = Earning.objects.select_for_update().filter(
            detailer=detailer, payment_status="pending"
        )
        if in_flight_earning_ids:
            base_qs = base_qs.exclude(id__in=in_flight_earning_ids)

        if raw_earning_ids:
            earnings = list(base_qs.filter(id__in=raw_earning_ids))
            if len(earnings) != len({str(e) for e in raw_earning_ids}):
                return None, Response(
                    {
                        "error": "Some earnings are not eligible for payout. "
                        "They may already be paid or part of another in-flight payout."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            earnings = list(base_qs)

        if not earnings:
            return None, Response(
                {"error": "This crew member has no unpaid earnings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total = sum((e.net_amount or Decimal("0")) for e in earnings)
        if total <= 0:
            return None, Response(
                {"error": "Total payable amount must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return earnings, total

    def _post_create_crew_payout(self, request, **kwargs):
        """Support creates a payout for a crew member from their unpaid earnings.

        Body:
        - ``crew_member_id`` (required)
        - ``earning_ids`` (optional): restrict payout to these specific earnings.
          When omitted, all currently-unpaid earnings are bundled.
        - ``admin_notes`` (optional)

        The crew member's primary bank account (or any bank account) is linked when
        available. If no bank account exists, the payout is created without one;
        support records the transfer reference when marking the payout as paid.
        """
        data = request.data if hasattr(request.data, "get") else {}
        crew_id = (data.get("crew_member_id") or "").strip()
        admin_notes = (data.get("admin_notes") or "").strip()
        raw_earning_ids = data.get("earning_ids") or []
        if not isinstance(raw_earning_ids, list):
            raw_earning_ids = []

        if not crew_id:
            return Response(
                {"error": "crew_member_id required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            detailer = Detailer.objects.select_related("user").get(pk=crew_id)
        except (Detailer.DoesNotExist, ValueError):
            return Response({"error": "Crew member not found"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            earnings, total_or_resp = self._bundle_unpaid_earnings_for_payout(
                detailer, raw_earning_ids
            )
            if earnings is None:
                return total_or_resp  # type: ignore[return-value]
            total = total_or_resp  # type: ignore[assignment]

            bank_account = _resolve_bank_account_for_detailer(detailer)

            payout = PayoutHistory.objects.create(
                detailer=detailer,
                bank_account=bank_account,
                payout_amount=total,
                status="pending",
                payment_type="scheduled",
                failure_reason=admin_notes or None,
            )
            payout.earnings.set(earnings)

        logger.info(
            "Support created crew payout: id=%s crew=%s amount=%s earnings=%s",
            payout.id,
            detailer.id,
            total,
            len(earnings),
        )
        return Response(
            {
                "data": {
                    "message": "Payout created. Mark as paid after bank transfer.",
                    "payout": _serialize_crew_payout(payout),
                }
            },
            status=status.HTTP_201_CREATED,
        )

    def _post_record_crew_payment_made(self, request, **kwargs):
        """Create a payout from unpaid earnings and mark it completed in one step.

        Used when support has already sent the bank transfer. This writes completed
        payout history visible in the crew app without leaving a duplicate pending row.
        """
        data = request.data if hasattr(request.data, "get") else {}
        crew_id = (data.get("crew_member_id") or "").strip()
        admin_notes = (data.get("admin_notes") or "").strip()
        payment_reference = (data.get("payment_reference") or "").strip()
        raw_earning_ids = data.get("earning_ids") or []
        if not isinstance(raw_earning_ids, list):
            raw_earning_ids = []

        if not crew_id:
            return Response(
                {"error": "crew_member_id required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            detailer = Detailer.objects.select_related("user").get(pk=crew_id)
        except (Detailer.DoesNotExist, ValueError):
            return Response({"error": "Crew member not found"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            earnings, total_or_resp = self._bundle_unpaid_earnings_for_payout(
                detailer, raw_earning_ids
            )
            if earnings is None:
                return total_or_resp  # type: ignore[return-value]
            total = total_or_resp  # type: ignore[assignment]

            bank_account = _resolve_bank_account_for_detailer(detailer)

            payout = PayoutHistory.objects.create(
                detailer=detailer,
                bank_account=bank_account,
                payout_amount=total,
                status="pending",
                payment_type="scheduled",
                failure_reason=admin_notes or None,
            )
            payout.earnings.set(earnings)

            if payment_reference:
                payout.payout_reference = payment_reference
            external_id = payment_reference
            if admin_notes and payment_reference:
                external_id = f"{payment_reference} | {admin_notes}"[:100]
            elif admin_notes:
                external_id = admin_notes[:100]
            # Payout marking: one-step create + complete for support who already sent transfer.
            payout.mark_as_completed(external_transaction_id=external_id or None)

        payout_id = payout.id

        logger.info(
            "Support recorded crew payment: id=%s crew=%s amount=%s earnings=%s",
            payout_id,
            detailer.id,
            total,
            len(earnings),
        )

        payout = (
            PayoutHistory.objects.select_related("detailer", "detailer__user")
            .prefetch_related("earnings")
            .get(pk=payout_id)
        )
        return Response(
            {
                "data": {
                    "message": "Payment recorded. Payout history updated in the crew app.",
                    "payout": _serialize_crew_payout(payout),
                    "earnings_marked_paid": len(earnings),
                }
            },
            status=status.HTTP_200_OK,
        )
