"""
Resolve crew ``ServiceType`` rows by name without fuzzy/contains matching.

Lookup order (accept only when the result is unique):
1. Exact ``name``
2. Case-insensitive ``name__iexact``
3. Trimmed, collapsed-whitespace, casefolded equality

Ambiguous matches (two catalog rows for the same normalised name) fail closed.
"""
from __future__ import annotations

from main.models import ServiceType


class AmbiguousServiceType(Exception):
    """More than one catalog row matches the incoming service name."""

    def __init__(self, name: str, matches: list[ServiceType]):
        self.name = name
        self.matches = matches
        labels = ", ".join(repr(row.name) for row in matches)
        super().__init__(
            f"Service type {name!r} matches more than one catalog row ({labels})"
        )


def normalize_service_name(name: str | None) -> str:
    """Trim, collapse internal whitespace, and casefold for comparison."""
    return " ".join((name or "").casefold().split())


def resolve_job_duration(data: dict | None, service_type: ServiceType) -> int:
    """
    Minutes for a new job: client ``duration`` / ``service_duration``, else catalog, else 60.
    """
    payload = data if isinstance(data, dict) else {}
    raw = payload.get("duration")
    if raw is None:
        raw = payload.get("service_duration")
    try:
        duration = int(raw)
    except (TypeError, ValueError):
        duration = 0
    if duration > 0:
        return duration
    try:
        catalog = int(getattr(service_type, "duration", 0) or 0)
    except (TypeError, ValueError):
        catalog = 0
    return catalog if catalog > 0 else 60


def resolve_service_type(raw_name: str | None) -> ServiceType:
    """
    Return the unique ``ServiceType`` for ``raw_name``.

    Raises:
        ServiceType.DoesNotExist: No unique match (including empty name).
        AmbiguousServiceType: More than one row matches.
    """
    name = (raw_name or "").strip()
    if not name:
        raise ServiceType.DoesNotExist("empty")

    exact = list(ServiceType.objects.filter(name=name)[:3])
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        raise AmbiguousServiceType(name, exact)

    iexact = list(ServiceType.objects.filter(name__iexact=name)[:3])
    if len(iexact) == 1:
        return iexact[0]
    if len(iexact) > 1:
        raise AmbiguousServiceType(name, iexact)

    needle = normalize_service_name(name)
    hits = [
        row
        for row in ServiceType.objects.all()
        if normalize_service_name(row.name) == needle
    ]
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        raise AmbiguousServiceType(name, hits)

    raise ServiceType.DoesNotExist(name)


def service_type_error_response(exc: Exception, raw_name: str | None) -> tuple[dict, int]:
    """JSON body and HTTP status for a failed service-type lookup."""
    from rest_framework import status

    label = (raw_name or "").strip() or "Unknown"
    if isinstance(exc, AmbiguousServiceType):
        names = ", ".join(repr(row.name) for row in exc.matches)
        return (
            {
                "success": False,
                "error": (
                    f"Service type {label!r} matches more than one catalog row "
                    f"({names}). Keep one unique name in the crew catalog."
                ),
            },
            status.HTTP_400_BAD_REQUEST,
        )
    return (
        {
            "success": False,
            "error": f"Service type '{label}' not found",
        },
        status.HTTP_400_BAD_REQUEST,
    )
