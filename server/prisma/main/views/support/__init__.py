"""
Support-facing API views for the detailer (crew) service.

These modules are mounted under ``/api/v1/support/`` and are called by the support
Django app via ``X-Support-Internal-Key``, not by detailer mobile JWTs.

**Auth:** :class:`support_permission_access.SupportPermissionAccess` on every view.

**Actions:** See each submodule's ``**Actions:**`` block (crew, jobs, payouts).

**Modules:**
- ``support_crew`` — crew directory list, detail, and status updates
- ``support_jobs`` — job reassignment and replacement detailer search
- ``support_payouts`` — crew payout queue, unpaid earnings, and payout lifecycle
- ``support_permission_access`` — shared DRF permission class
"""
