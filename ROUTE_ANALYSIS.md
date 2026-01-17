# Complete Route Analysis

## Frontend Configuration

**Base URL**: `/api` (from `REACT_APP_API_BASE_URL`)

### Frontend Routes (with baseURL applied)

#### Auth Routes (NO `/api` prefix in endpoint)
- `POST /auth/login` → **`/api/auth/login`**
- `GET /auth/users/me` → **`/api/auth/users/me`**

#### Admin Routes (`/api` prefix in endpoint)
- `GET /api/admin/users` → **`/api/api/admin/users`** ❌ DOUBLE
- `POST /api/admin/users` → **`/api/api/admin/users`** ❌ DOUBLE
- `PUT /api/admin/users/{id}/role` → **`/api/api/admin/users/{id}/role`** ❌ DOUBLE
- `DELETE /api/admin/users/{id}` → **`/api/api/admin/users/{id}`** ❌ DOUBLE
- `GET /api/admin/roles` → **`/api/api/admin/roles`** ❌ DOUBLE

#### Dashboard Routes (`/api` prefix in endpoint)
- `GET /api/dashboards` → **`/api/api/dashboards`** ❌ DOUBLE
- `POST /api/dashboards` → **`/api/api/dashboards`** ❌ DOUBLE
- `GET /api/dashboards/{id}` → **`/api/api/dashboards/{id}`** ❌ DOUBLE
- `PUT /api/dashboards/{id}` → **`/api/api/dashboards/{id}`** ❌ DOUBLE
- `DELETE /api/dashboards/{id}` → **`/api/api/dashboards/{id}`** ❌ DOUBLE

#### Explorer Routes (`/api` prefix in endpoint)
- `GET /api/explorer/databases` → **`/api/api/explorer/databases`** ❌ DOUBLE
- `GET /api/explorer/databases/{db}/schemas` → **`/api/api/explorer/databases/{db}/schemas`** ❌ DOUBLE
- `GET /api/explorer/databases/{db}/schemas/{schema}/objects` → **`/api/api/explorer/databases/{db}/schemas/{schema}/objects`** ❌ DOUBLE
- `GET /api/explorer/databases/{db}/schemas/{schema}/tables/{table}` → **`/api/api/explorer/databases/{db}/schemas/{schema}/tables/{table}`** ❌ DOUBLE
- `GET /api/explorer/search` → **`/api/api/explorer/search`** ❌ DOUBLE

#### REST API Routes (`/api` prefix in endpoint)
- `POST /api/generate-sql` → **`/api/api/generate-sql`** ❌ DOUBLE
- `POST /api/execute-sql` → **`/api/api/execute-sql`** ❌ DOUBLE
- `GET /api/query-history` → **`/api/api/query-history`** ❌ DOUBLE (if exists)

#### Preferences Routes (`/api` prefix in endpoint)
- `GET /api/preferences` → **`/api/api/preferences`** ❌ DOUBLE
- `POST /api/preferences` → **`/api/api/preferences`** ❌ DOUBLE
- `DELETE /api/preferences/{id}` → **`/api/api/preferences/{id}`** ❌ DOUBLE
- `PATCH /api/preferences/{id}/boost` → **`/api/api/preferences/{id}/boost`** ❌ DOUBLE

#### Metadata Routes (`/api` prefix in endpoint)
- `GET /api/metadata/descriptions` → **`/api/api/metadata/descriptions`** ❌ DOUBLE
- `POST /api/metadata/descriptions` → **`/api/api/metadata/descriptions`** ❌ DOUBLE
- `PUT /api/metadata/descriptions/{id}` → **`/api/api/metadata/descriptions/{id}`** ❌ DOUBLE
- `DELETE /api/metadata/descriptions/{id}` → **`/api/api/metadata/descriptions/{id}`** ❌ DOUBLE

#### File Upload Routes (`/api` prefix in endpoint)
- `POST /api/file-uploads/upload` → **`/api/api/file-uploads/upload`** ❌ DOUBLE
- `GET /api/file-uploads/tables` → **`/api/api/file-uploads/tables`** ❌ DOUBLE
- `DELETE /api/file-uploads/tables/{id}` → **`/api/api/file-uploads/tables/{id}`** ❌ DOUBLE

#### Public Routes (`/api` prefix in endpoint)
- `GET /api/public/dashboards` → **`/api/api/public/dashboards`** ❌ DOUBLE
- `GET /api/public/dashboards/{id}` → **`/api/api/public/dashboards/{id}`** ❌ DOUBLE
- `POST /api/public/register` → **`/api/api/public/register`** ❌ DOUBLE
- `GET /api/public/registration/health` → **`/api/api/public/registration/health`** ❌ DOUBLE

---

## Nexus Router Configuration (CURRENT - After Last Change)

```python
router = APIRouter(prefix="", tags=["REST API"])  
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])  
explorer_router = APIRouter(prefix="/explorer", tags=["Schema Explorer"])  
dashboard_router = APIRouter(prefix="/dashboards", tags=["Dashboards"])  
public_router = APIRouter(prefix="/public", tags=["Public Access (No Auth)"])
admin_router = APIRouter(prefix="/admin", tags=["Admin"])
metadata_router = APIRouter(prefix="/metadata", tags=["metadata"])
file_upload_router = APIRouter(prefix="/file-uploads", tags=["file-uploads"])
preferences_router = APIRouter(prefix="/preferences", tags=["User Preferences"])
```

### Expected Nexus Routes (what Nexus receives after ingress forwards)
- `/api/auth/login` → Should match `auth_router (/auth) + /login` ❌ MISMATCH
- `/api/api/dashboards` → Should match `dashboard_router (/dashboards)` ❌ MISMATCH
- `/api/api/explorer/databases` → Should match `explorer_router (/explorer) + /databases` ❌ MISMATCH

---

## Ingress Configuration (CURRENT)

```yaml
paths:
  - path: /api       # Backend API
    pathType: Prefix
    service: nexus
  - path: /          # Frontend UI
    pathType: Prefix
    service: frontend
```

**No URL rewriting** - Forwards requests as-is to Nexus

---

## THE PROBLEM

**Frontend sends**: `/api/api/dashboards`  
**Ingress forwards**: `/api/api/dashboards` (no rewriting)  
**Nexus expects**: `/dashboards` (with router prefix)  
**Result**: 404 ❌

---

## SOLUTION OPTIONS

### Option 1: Remove `/api` from ALL Frontend Endpoints (BREAKING CHANGE)
- Change all frontend endpoints from `/api/xyz` to `/xyz`
- Keep Nexus router prefixes as-is
- **Impact**: Requires frontend code changes in ~15 files

### Option 2: Add `/api` Back to Nexus Router Prefixes  
- Change router prefixes back to `/api/xyz`
- Fix auth_router to `/api/auth` (consistency)
- Keep frontend as-is
- **Impact**: Minimal - just Nexus router config

### Option 3: Use Ingress URL Rewriting
- Strip `/api` prefix in ingress before forwarding to Nexus
- Keep Nexus router prefixes without `/api`
- Keep frontend as-is
- **Impact**: Ingress config change only

---

## RECOMMENDED SOLUTION: Option 2

**Restore `/api` prefix to all Nexus routers for consistency**

```python
# Nexus router configuration
router = APIRouter(prefix="/api", tags=["REST API"])  
auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])  
explorer_router = APIRouter(prefix="/api/explorer", tags=["Schema Explorer"])  
dashboard_router = APIRouter(prefix="/api/dashboards", tags=["Dashboards"])  
public_router = APIRouter(prefix="/api/public", tags=["Public Access (No Auth)"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])
metadata_router = APIRouter(prefix="/api/metadata", tags=["metadata"])
file_upload_router = APIRouter(prefix="/api/file-uploads", tags=["file-uploads"])
preferences_router = APIRouter(prefix="/api/preferences", tags=["User Preferences"])
```

**Why this works**:
- Frontend: `/api` (baseURL) + `/api/dashboards` (endpoint) = `/api/api/dashboards` ✅
- Nexus: Receives `/api/api/dashboards`, matches `router (/api) + dashboard_router (/api/dashboards) + endpoint ("")` ✅
- No breaking changes to frontend code
- Consistent with existing pattern
