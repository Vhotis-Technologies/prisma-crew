"""
Crew (detailer) directory for support: list, profile-style detail, and PATCH updates.

**Auth:** ``SupportPermissionAccess`` — the support server calls this with
``X-Support-Internal-Key``; these views are **not** authenticated with detailer JWTs.

**Endpoints:** ``get_crew_list`` (optional ``q`` search), ``get_crew_detail`` (``crew_id``),
``update_crew`` (toggle ``is_active`` / ``is_verified``).

Serialization helpers below format users attached to ``Detailer`` rows for the mobile app.
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

REVIEW_COMMENT_LIMIT = 50


def _fmt_display_date(dt) -> str:
    if not dt:
        return ""
    if timezone.is_aware(dt):
        dt = timezone.localtime(dt)
    return dt.strftime("%d %b %Y")


def _headline(detailer: Detailer) -> str:
    loc = (detailer.city or "").strip() or (detailer.post_code or "").strip() or (detailer.country or "").strip()
    if loc:
        return f"Detailer · {loc}"
    return "Detailer"


def _serialize_list_item(detailer: Detailer) -> dict:
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
    return Q(primary_detailer=detailer) | Q(detailers=detailer)


def _serialize_detail(detailer: Detailer) -> dict:
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
    """
    No session auth: ``authentication_classes = ()`` so only the shared support key applies.

    Dispatches ``action`` from the URL to GET/PATCH handlers defined in
    ``action_handler_get`` / ``action_handler_patch``.
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
        action = kwargs.get("action")
        if action not in self.action_handler_get:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler_get[action])
        return handler(request)

    def patch(self, request, *args, **kwargs):
        action = kwargs.get("action")
        if action not in self.action_handler_patch:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler_patch[action])
        return handler(request)

    def _get_crew_list(self, request):
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
