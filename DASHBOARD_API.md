# Dashboard API Documentation

Complete CRUD API for dashboards, tiles, and RBAC permissions.  
**Includes anonymous/public access endpoints (no authentication required).**

---

## 🔐 **Authentication & RBAC**

All endpoints require authentication (`Bearer token`).  
Permissions are automatically verified:
- **View**: See dashboard and tiles
- **Edit**: Modify dashboard, add/edit/delete tiles
- **Delete**: Remove dashboard entirely
- **Share**: Grant/revoke permissions to other users/groups

**RBAC Rules:**
1. **Owners** have all permissions automatically
2. **ADMIN/SUPERADMIN** users have all permissions on all dashboards
3. **Public dashboards** are viewable by all authenticated users
4. **Explicit permissions** can be granted to users or groups

---

## 📊 **Dashboard Endpoints**

### `GET /api/dashboards`
**Get all accessible dashboards with RBAC filtering**

**Query Parameters:**
- `include_public` (boolean, default: `true`) - Include public dashboards
- `favorites_only` (boolean, default: `false`) - Show only favorited dashboards

**Response:**
```json
{
  "success": true,
  "dashboards": [
    {
      "id": "uuid",
      "title": "Sales Dashboard",
      "description": "Q4 2024 sales metrics",
      "owner_user_id": "uuid",
      "owner_username": "john.doe",
      "is_public": false,
      "is_favorite": true,
      "tags": ["sales", "q4"],
      "tile_count": 5,
      "permissions": {
        "can_view": true,
        "can_edit": true,
        "can_delete": false,
        "can_share": false
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-12-07T14:20:00Z",
      "last_accessed_at": "2024-12-07T15:00:00Z"
    }
  ],
  "total": 1
}
```

---

### `GET /api/dashboards/{dashboard_id}`
**Get single dashboard by ID (with permission check)**

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "id": "uuid",
    "title": "Sales Dashboard",
    "description": "Q4 2024 sales metrics",
    "configuration": {},
    "layout_config": {
      "columns": 12,
      "rowHeight": 100,
      "compactType": "vertical"
    },
    "owner_user_id": "uuid",
    "owner_username": "john.doe",
    "owner_group_id": null,
    "is_public": false,
    "is_favorite": true,
    "tags": ["sales", "q4"],
    "tile_count": 5,
    "permissions": {
      "can_view": true,
      "can_edit": true,
      "can_delete": true,
      "can_share": true
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-12-07T14:20:00Z",
    "last_accessed_at": "2024-12-07T15:00:00Z"
  }
}
```

**Error Responses:**
- `404` - Dashboard not found or access denied

---

### `POST /api/dashboards`
**Create new dashboard**

**Request Body:**
```json
{
  "title": "Sales Dashboard",
  "description": "Q4 2024 sales metrics",
  "configuration": {},
  "layout_config": {
    "columns": 12,
    "rowHeight": 100
  },
  "tags": ["sales", "q4"],
  "is_public": false,
  "owner_group_id": null
}
```

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "id": "uuid",
    "title": "Sales Dashboard",
    "description": "Q4 2024 sales metrics",
    "owner_user_id": "uuid",
    "is_public": false,
    "created_at": "2024-12-07T15:00:00Z",
    "updated_at": "2024-12-07T15:00:00Z"
  }
}
```

---

### `PUT /api/dashboards/{dashboard_id}`
**Update dashboard (requires edit permission)**

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "is_favorite": true,
  "tags": ["sales", "q4", "2024"]
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `403` - Permission denied or dashboard not found

---

### `DELETE /api/dashboards/{dashboard_id}`
**Delete dashboard (requires delete permission)**

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `403` - Permission denied or dashboard not found

---

## 📈 **Tile Endpoints**

### `GET /api/dashboards/{dashboard_id}/tiles`
**Get all tiles for dashboard (requires view permission)**

**Response:**
```json
{
  "success": true,
  "tiles": [
    {
      "id": "uuid",
      "dashboard_id": "uuid",
      "title": "Top Products",
      "description": "Best selling products this month",
      "sql_query": "SELECT product_name, SUM(revenue) as total FROM sales GROUP BY product_name ORDER BY total DESC LIMIT 10",
      "natural_language_query": "show top 10 products by revenue",
      "chart_type": "bar",
      "chart_config": {
        "colors": ["#3b82f6"],
        "orientation": "vertical"
      },
      "position": {
        "x": 0,
        "y": 0,
        "width": 6,
        "height": 4
      },
      "refresh_interval_seconds": 300,
      "last_refreshed_at": "2024-12-07T14:55:00Z",
      "created_by": "uuid",
      "created_by_username": "john.doe",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-12-07T14:20:00Z"
    }
  ],
  "total": 1
}
```

---

### `POST /api/dashboards/{dashboard_id}/tiles`
**Create new tile (requires edit permission)**

**Request Body:**
```json
{
  "title": "Revenue Chart",
  "sql_query": "SELECT date, SUM(revenue) as total FROM sales GROUP BY date",
  "chart_type": "line",
  "position_x": 0,
  "position_y": 0,
  "width": 6,
  "height": 4,
  "description": "Daily revenue trend",
  "natural_language_query": "show daily revenue trend",
  "chart_config": {
    "colors": ["#10b981"],
    "smooth": true
  },
  "refresh_interval_seconds": 300
}
```

**Supported Chart Types:**
- Basic: `bar`, `line`, `scatter`, `pie`, `donut`
- Statistical: `box`, `violin`, `histogram`, `histogram2d`
- 3D: `scatter3d`, `line3d`, `surface`, `mesh3d`
- Financial: `candlestick`, `ohlc`, `waterfall`, `funnel`
- Maps: `scattergeo`, `choropleth`, `scattermapbox`
- Specialized: `heatmap`, `contour`, `sankey`, `sunburst`, `treemap`, `parallel`, `parcoords`, `table`, `indicator`
- Multi-series: `area`, `stackedbar`, `groupedbar`, `bubble`

**Response:**
```json
{
  "success": true,
  "tile": {
    "id": "uuid",
    "dashboard_id": "uuid",
    "title": "Revenue Chart",
    "chart_type": "line",
    "created_at": "2024-12-07T15:00:00Z",
    "updated_at": "2024-12-07T15:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Permission denied (no edit access)

---

### `PUT /api/dashboards/{dashboard_id}/tiles/{tile_id}`
**Update tile (requires edit permission)**

**Request Body:**
```json
{
  "title": "Updated Title",
  "position_x": 6,
  "width": 12
}
```

**Response:**
```json
{
  "success": true
}
```

---

### `DELETE /api/dashboards/{dashboard_id}/tiles/{tile_id}`
**Delete tile (requires edit permission)**

**Response:**
```json
{
  "success": true
}
```

---

## 🔐 **Permission / Sharing Endpoints**

### `POST /api/dashboards/{dashboard_id}/permissions`
**Grant permissions to user or group (requires share permission)**

**Request Body (User):**
```json
{
  "target_user_id": "uuid",
  "can_view": true,
  "can_edit": true,
  "can_delete": false,
  "can_share": false,
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Request Body (Group):**
```json
{
  "target_group_id": "uuid",
  "can_view": true,
  "can_edit": false,
  "can_delete": false,
  "can_share": false
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `403` - Permission denied (no share access)

---

### `DELETE /api/dashboards/{dashboard_id}/permissions`
**Revoke permissions (requires share permission)**

**Query Parameters:**
- `target_user_id` (optional) - User to revoke from
- `target_group_id` (optional) - Group to revoke from

**Response:**
```json
{
  "success": true
}
```

---

## 🌐 **Public Access Endpoints (No Authentication)**

These endpoints allow anonymous access to dashboards marked as `is_anonymous_public = TRUE`.  
Perfect for: embedded widgets, public status pages, marketing dashboards, iframe embeds.

### `GET /api/public/dashboards`
**List all anonymous-public dashboards (NO AUTH REQUIRED)**

**Response:**
```json
{
  "success": true,
  "dashboards": [
    {
      "id": "uuid",
      "title": "Executive Dashboard",
      "description": "Company-wide metrics",
      "layout_config": {...},
      "tags": ["public", "executive"],
      "tile_count": 5,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-12-07T14:20:00Z"
    }
  ],
  "total": 1
}
```

---

### `GET /api/public/dashboards/{dashboard_id}`
**Get anonymous-public dashboard (NO AUTH REQUIRED)**

Returns 404 if dashboard is not marked as `is_anonymous_public`.

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "id": "uuid",
    "title": "Executive Dashboard",
    "description": "Company-wide metrics",
    "layout_config": {...},
    "tags": ["public"],
    "tile_count": 5,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-12-07T14:20:00Z"
  }
}
```

**Error Responses:**
- `404` - Dashboard not found or not publicly accessible

---

### `GET /api/public/dashboards/{dashboard_id}/tiles`
**Get tiles for anonymous-public dashboard (NO AUTH REQUIRED)**

Returns empty array if dashboard is not anonymous-public.

**Response:**
```json
{
  "success": true,
  "tiles": [
    {
      "id": "uuid",
      "title": "Total Revenue",
      "description": "YTD revenue",
      "sql_query": "SELECT SUM(revenue) FROM sales",
      "chart_type": "indicator",
      "chart_config": {...},
      "position": {"x": 0, "y": 0, "width": 4, "height": 2},
      "refresh_interval_seconds": 300,
      "last_refreshed_at": "2024-12-07T15:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 🔒 **Public vs Anonymous-Public**

| Flag | Requires Auth | Who Can View | Use Case |
|------|---------------|--------------|----------|
| `is_public = FALSE` | ✅ Yes | Owner + explicitly granted users/groups | Private team dashboards |
| `is_public = TRUE` | ✅ Yes | All authenticated users | Company-wide dashboards |
| `is_anonymous_public = TRUE` | ❌ No | Anyone (even anonymous) | Public status pages, embeds |

**Note:** `is_anonymous_public = TRUE` automatically sets `is_public = TRUE` (constraint enforced)

---

## 📝 **Usage Examples**

### Example 1: Create Dashboard and Add Tile
```bash
# 1. Create dashboard
curl -X POST http://localhost:8000/api/dashboards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sales Dashboard",
    "is_public": false
  }'

# 2. Add tile
curl -X POST http://localhost:8000/api/dashboards/{dashboard_id}/tiles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Top Products",
    "sql_query": "SELECT product_name, SUM(revenue) FROM sales GROUP BY 1 ORDER BY 2 DESC LIMIT 10",
    "chart_type": "bar",
    "width": 6,
    "height": 4
  }'
```

### Example 2: Share Dashboard with Team
```bash
# Grant view + edit to entire team group
curl -X POST http://localhost:8000/api/dashboards/{dashboard_id}/permissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_group_id": "team_uuid",
    "can_view": true,
    "can_edit": true
  }'
```

### Example 3: Get All Favorite Dashboards
```bash
curl "http://localhost:8000/api/dashboards?favorites_only=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔍 **RBAC Permission Matrix**

| Action | Owner | Viewer | Editor | Admin | SUPERADMIN |
|--------|-------|--------|--------|-------|------------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Dashboard | ✅ | ❌ | ✅ | ✅ | ✅ |
| Delete Dashboard | ✅ | ❌ | ❌ | ✅ | ✅ |
| Add/Edit/Delete Tiles | ✅ | ❌ | ✅ | ✅ | ✅ |
| Share (Grant Permissions) | ✅ | ❌ | ❌ | ✅ | ✅ |

**Notes:**
- Public dashboards are viewable by all authenticated users
- Explicit permissions can override role-based defaults
- Permissions can be granted to individual users or entire groups
- Temporary access via `expires_at` is supported

---

## 🚀 **Production Best Practices**

1. **Pagination**: For large dashboard lists, add pagination parameters
2. **Caching**: Dashboard metadata is cached automatically
3. **Audit Logging**: All permission changes are logged
4. **Rate Limiting**: Implement on production frontends
5. **Error Handling**: Always check `success` field in responses
6. **Timeouts**: Set appropriate timeouts for SQL queries in tiles

---

**Documentation Version:** 1.0  
**Last Updated:** December 7, 2024

