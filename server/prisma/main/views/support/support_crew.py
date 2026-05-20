"""
Crew (detailer) directory for support: list, profile-style detail, and PATCH updates.

**Auth:** :class:`SupportPermissionAccess` — support server proxies with
``X-Support-Internal-Key``; detailer JWTs are not used.

**Actions:**
- ``GET get_crew_list`` — searchable crew directory (optional ``q``)
- ``GET get_crew_detail`` — profile, ratings, earnings summary (``crew_id``)
- ``PATCH update_crew`` — toggle ``is_active`` / ``is_verified`` (``crew_id`` in body)
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from main.models import Detailer, Earning, Job, Review
from main.views.support.support_permission_access import SupportPermissionAccess

# Max recent review comments included in crew detail payload.
REVIEW_COMMENT_LIMIT = 50


def _fmt_display_date(dt) -> str:
    """Format a datetime for support UI labels (``%d %b %Y``)."""
    if not dt:
        return ""
    if timezone.is_aware(dt):
        dt = timezone.localtime(dt)
    return dt.strftime("%d %b %Y")


def _headline(detailer: Detailer) -> str:
    """Short location line for list cards (city, post code, or country)."""
    loc = (detailer.city or "").strip() or (detailer.post_code or "").strip() or (detailer.country or "").strip()
    if loc:
        return f"Detailer · {loc}"
    return "Detailer"


def _serialize_list_item(detailer: Detailer) -> dict:
    """Minimal crew row for directory search results."""
    u = detailer.user
    return {
        "id": str(detailer.id),
        "name": u.get_full_name(),
        "email": u.email,
        "phone": u.phone or "",
        "is_active": detailer.is_active,
        "is_verified": detailer.is_verified,
        "headline": _headline(detailer),
    }


def _job_filter_for_detailer(detailer: Detailer):
    """Q filter matching jobs where the detailer is primary or on the M2M team."""
    return Q(primary_detailer=detailer) | Q(detailers=detailer)


def _serialize_detail(detailer: Detailer) -> dict:
    """Full crew profile payload including ratings, bookings, and recent comments."""
    base = _serialize_list_item(detailer)
    u = detailer.user

    jobs_qs = Job.objects.filter(_job_filter_for_detailer(detailer)).distinct()
    total_bookings = jobs_qs.count()

    reviews_agg = Review.objects.filter(detailer=detailer).aggregate(
        avg=Avg("rating"),
        n=Count("id"),
    )
    avg_rating = reviews_agg["avg"]
    if avg_rating is not None:
        average_rating = float(round(float(avg_rating), 2))
    else:
        average_rating = float(detailer.rating or 0)

    total_ratings = reviews_agg["n"] or 0

    earnings_sum = (
        Earning.objects.filter(detailer=detailer).aggregate(s=Sum("net_amount"))["s"]
        or Decimal("0")
    )
    lifetime_earnings = float(earnings_sum)

    comments = []
    for rev in (
        Review.objects.filter(detailer=detailer)
        .select_related("job")
        .order_by("-created_at")[:REVIEW_COMMENT_LIMIT]
    ):
        j = rev.job
        comments.append(
            {
                "id": str(rev.id),
                "created_at": _fmt_display_date(rev.created_at),
                "text": (rev.comment or "").strip() or "—",
                "author_label": j.client_name if j else "Customer",
                "source": "customer",
                "rating": float(rev.rating) if rev.rating is not None else None,
            }
        )

    out = {
        **base,
        "date_joined": _fmt_display_date(u.date_joined),
        "lifetime_earnings": lifetime_earnings,
        "average_rating": average_rating,
        "total_ratings": int(total_ratings),
        "total_bookings": total_bookings,
        "bio": None,
        "specialties": [],
        "service_areas": [],
        "vehicle_types": [],
        "comments": comments,
    }
    return out


class CrewView(APIView):
    """Support crew directory: list, detail, and admin status updates.

    Detailer JWT authentication is disabled; only :class:`SupportPermissionAccess` applies.
    """

    authentication_classes = ()
    permission_classes = [SupportPermissionAccess]

    action_handler_get = {
        "get_crew_list": "_get_crew_list",
        "get_crew_detail": "_get_crew_detail",
    }
    action_handler_patch = {
        "update_crew": "_update_crew",
    }

    def get(self, request, *args, **kwargs):
        """Dispatch GET ``action`` to list or detail handler."""
        action = kwargs.get("action")
        if action not in self.action_handler_get:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler_get[action])
        return handler(request)

    def patch(self, request, *args, **kwargs):
        """Dispatch PATCH ``action`` (currently ``update_crew`` only)."""
        action = kwargs.get("action")
        if action not in self.action_handler_patch:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler_patch[action])
        return handler(request)

    def _get_crew_list(self, request):
        """Return all detailers, optionally filtered by ``q`` on name/email/phone."""
        qs = Detailer.objects.select_related("user").filter(user__is_detailer=True)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(user__first_name__icontains=q)
                | Q(user__last_name__icontains=q)
                | Q(user__email__icontains=q)
                | Q(user__phone__icontains=q)
            )
        qs = qs.order_by("user__last_name", "user__first_name")
        crew = [_serialize_list_item(d) for d in qs]
        return Response({"data": {"crew": crew}}, status=status.HTTP_200_OK)

    def _get_crew_detail(self, request):
        """Return one crew member profile; requires ``crew_id`` query param."""
        raw_id = request.query_params.get("crew_id")
        if not raw_id:
            return Response({"error": "crew_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid = uuid.UUID(str(raw_id))
        except (ValueError, TypeError):
            return Response({"error": "Invalid crew_id"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            detailer = Detailer.objects.select_related("user").get(pk=uid, user__is_detailer=True)
        except Detailer.DoesNotExist:
            return Response({"error": "Crew member not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": {"crew": _serialize_detail(detailer)}}, status=status.HTTP_200_OK)

    def _update_crew(self, request):
        """PATCH ``is_active`` and/or ``is_verified``; deactivating clears ``is_available``."""
        raw_id = request.data.get("crew_id")
        if not raw_id:
            return Response({"error": "crew_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid = uuid.UUID(str(raw_id))
        except (ValueError, TypeError):
            return Response({"error": "Invalid crew_id"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            detailer = Detailer.objects.select_related("user").get(pk=uid, user__is_detailer=True)
        except Detailer.DoesNotExist:
            return Response({"error": "Crew member not found"}, status=status.HTTP_404_NOT_FOUND)

        changed = False
        if "is_active" in request.data:
            detailer.is_active = bool(request.data.get("is_active"))
            if not detailer.is_active:
                detailer.is_available = False
            changed = True
        if "is_verified" in request.data:
            detailer.is_verified = bool(request.data.get("is_verified"))
            changed = True
        if changed:
            detailer.save()

        return Response({"data": {"crew": _serialize_detail(detailer)}}, status=status.HTTP_200_OK)
