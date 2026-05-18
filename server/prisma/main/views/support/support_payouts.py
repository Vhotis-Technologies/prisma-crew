"""
Crew payout queue for support: list pending/processing payouts, list unpaid earnings,
create new payouts from unpaid earnings, and mark payouts as completed.

Crew members cannot self-initiate payouts; only support can create a payout from
pending earnings. After bank transfer, support marks the payout as paid which in turn
marks the linked earnings as paid.

**Auth:** ``SupportPermissionAccess`` (``X-Support-Internal-Key`` from support server).
"""
from __future__ import annotations

import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from main.models import BankAccount, Detailer, Earning, PayoutHistory
from main.views.support.support_permission_access import SupportPermissionAccess

logger = logging.getLogger(__name__)


def _fmt_display_date(dt) -> str:
    if not dt:
        return ""
    if timezone.is_aware(dt):
        dt = timezone.localtime(dt)
    return dt.strftime("%d %b %Y")


def _iso(dt) -> str:
    if not dt:
        return ""
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def _serialize_crew_payout(payout: PayoutHistory) -> dict:
    detailer = payout.detailer
    user = detailer.user if detailer else None
    earnings = payout.earnings.all().order_by("created_at")
    period_start = earnings.first().created_at.date() if earnings.exists() else payout.created_at.date()
    period_end = earnings.last().created_at.date() if earnings.exists() else payout.created_at.date()
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


def _serialize_unpaid_earning(earning: Earning) -> dict:
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
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get("action")
        if action not in self.get_action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        return getattr(self, self.get_action_handler[action])(request, **kwargs)

    def post(self, request, *args, **kwargs):
        action = kwargs.get("action")
        if action not in self.post_action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        return getattr(self, self.post_action_handler[action])(request, **kwargs)

    def _get_payout_queue(self, request, **kwargs):
        status_filter = (request.query_params.get("status") or "").strip().lower()
        qs = PayoutHistory.objects.select_related("detailer", "detailer__user").order_by("-initiated_at")
        if status_filter in ("pending", "processing", "completed", "failed", "cancelled"):
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.filter(status__in=["pending", "processing"])
        rows = [_serialize_crew_payout(p) for p in qs[:100]]
        return Response({"data": {"payout_requests": rows}}, status=status.HTTP_200_OK)

    def _get_crew_payout_detail(self, request, **kwargs):
        payout_id = (request.query_params.get("payout_id") or "").strip()
        if not payout_id:
            return Response({"error": "payout_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payout = PayoutHistory.objects.select_related("detailer", "detailer__user").get(pk=payout_id)
        except PayoutHistory.DoesNotExist:
            return Response({"error": "Payout not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": {"payout": _serialize_crew_payout(payout)}}, status=status.HTTP_200_OK)

    def _post_mark_payout_paid(self, request, **kwargs):
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
        """Return per-job unpaid earnings for a single crew member."""
        crew_id = (request.query_params.get("crew_member_id") or "").strip()
        if not crew_id:
            return Response(
                {"error": "crew_member_id required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            detailer = Detailer.objects.select_related("user").get(pk=crew_id)
        except (Detailer.DoesNotExist, ValueError):
            return Response({"error": "Crew member not found"}, status=status.HTTP_404_NOT_FOUND)

        in_flight_earning_ids = set(
            PayoutHistory.objects.filter(
                detailer=detailer, status__in=["pending", "processing"]
            ).values_list("earnings__id", flat=True)
        )
        in_flight_earning_ids.discard(None)

        earnings_qs = (
            Earning.objects.select_related("job", "job__service_type")
            .filter(detailer=detailer, payment_status="pending")
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
                }
            },
            status=status.HTTP_200_OK,
        )

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
                    return Response(
                        {
                            "error": "Some earnings are not eligible for payout. "
                            "They may already be paid or part of another in-flight payout."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                earnings = list(base_qs)

            if not earnings:
                return Response(
                    {"error": "This crew member has no unpaid earnings."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            total = sum((e.net_amount or Decimal("0")) for e in earnings)
            if total <= 0:
                return Response(
                    {"error": "Total payable amount must be greater than zero."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            bank_account = (
                BankAccount.objects.filter(detailer=detailer, is_primary=True).first()
                or BankAccount.objects.filter(detailer=detailer).first()
            )

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
