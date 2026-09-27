# Role-Based Access Control

Implementation: `backend/app/core/security.py` (`require_roles()` FastAPI
dependency, applied per-endpoint) · Tests: `backend/tests/test_auth.py`

## Roles

`FARMER, FIELD_WORKER, VETERINARIAN, LAB_STAFF, DISTRICT_ADMIN,
STATE_ADMIN, SUPER_ADMIN`

## Enforcement

Every protected route declares its allowed roles explicitly:

```python
@router.get("")
def list_cases(user: dict = Depends(require_roles(
    "VETERINARIAN", "FIELD_WORKER", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"
))):
    ...
```

A request from a disallowed role receives `403 Forbidden` before any
handler code runs. There is no client-side-only enforcement anywhere in
the system — the Next.js `useRequireRole()` guard is a UX convenience, not
a security boundary; every API call is independently checked server-side.

## Permission summary

| Capability | Farmer | Field Worker | Vet | Lab | District Admin | State Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Manage own farms/animals | ✅ | ✅ | | | | | ✅ |
| Submit disease reports | ✅ | ✅ | | | | | |
| View own reports/alerts | ✅ | ✅ | | | | | |
| View/prioritize case queue | | ✅ | ✅ | | ✅ | ✅ | ✅ |
| Assign / update case status | | | ✅ | | ✅ | ✅ | ✅ |
| Record field visits | | ✅ | ✅ | | | | |
| Record diagnosis/treatment | | | ✅ | | | | |
| Request lab sample | | | ✅ | | | | |
| Update sample status/result | | | | ✅ | | | |
| Government dashboard | | | | | ✅ | ✅ | ✅ |
| GIS risk map | | | | | ✅ | ✅ | ✅ |
| Manage users | | | | | (list) | (list) | ✅ |
| View audit log | | | | | | ✅ | ✅ |

Authentication uses JWT access tokens (`python-jose`, HS256, 12-hour
expiry) with bcrypt-hashed passwords. Tokens carry `sub` (user id), `role`,
and `email` claims, verified on every request via the `get_current_user`
dependency.
