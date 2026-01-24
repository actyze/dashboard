# Schema Exclusion Feature - Implementation Summary

## Overview
Implemented a comprehensive feature to disable/hide unwanted databases, schemas, or tables from the AI schema service. This is a **global (org-level)** feature that removes resources from the FAISS index for all users.

## Key Features

### 1. **Global vs User-Level Distinction**
- **Global (Org-level)**:
  - Descriptions: Visible to all users
  - Exclusions (Hide/Show): Affects all users
- **User-level**:
  - Priority Boost: Only affects individual user's recommendations

### 2. **Hierarchical Exclusions**
- **Database-level**: Hide entire catalog (e.g., `supabase`)
- **Schema-level**: Hide specific schema within a catalog (e.g., `supabase.auth`)
- **Table-level**: Hide specific table (e.g., `supabase.actyze_ref.tenants`)

### 3. **FAISS Index Integration**
- Excluded resources are automatically removed from schema service FAISS index
- For table-level exclusions: Uses incremental remove (fast, ~1-5s)
- For database/schema-level exclusions: Triggers full refresh
- Re-enabling resources triggers a refresh to add them back

## Implementation Details

### Backend (Nexus)

#### 1. Database Migration
**File**: `nexus/db/migrations/V020__schema_exclusions.sql`
- Created `nexus.schema_exclusions` table
- Hierarchical structure with constraints
- Helper functions:
  - `nexus.is_resource_excluded()` - Check if resource is excluded
  - `nexus.get_all_exclusions()` - Get all exclusions

#### 2. SQLAlchemy Model
**File**: `nexus/app/database.py`
- Added `SchemaExclusion` model
- Fields: `id`, `catalog`, `schema_name`, `table_name`, `reason`, `excluded_by`, `created_at`

#### 3. Service Layer
**File**: `nexus/app/services/exclusion_service.py`
- `ExclusionService` class with methods:
  - `get_all_exclusions()` - List all exclusions
  - `add_exclusion()` - Add new exclusion
  - `remove_exclusion()` - Remove exclusion (re-enable)
  - `is_excluded()` - Check if resource is excluded
- Automatically notifies schema service when exclusions change

#### 4. API Endpoints
**File**: `nexus/app/api_exclusions.py`
- `GET /api/v1/exclusions` - List all exclusions (admin only)
- `POST /api/v1/exclusions` - Add exclusion (admin only)
- `DELETE /api/v1/exclusions/{id}` - Remove exclusion (admin only)
- `GET /api/v1/exclusions/check` - Check if resource is excluded (admin only)

#### 5. Main App Integration
**File**: `nexus/main.py`
- Registered `exclusions_router`

### Schema Service

#### Updated Files
**File**: `schema-service/schema_service.py`
- Added `fetch_exclusions()` - Fetch exclusions from Nexus database
- Added `apply_exclusions()` - Filter schemas based on exclusion rules
- Updated `refresh_schemas()` - Apply exclusions before building FAISS index

**Logic**:
1. Fetch all schemas from Trino
2. Fetch exclusions from Nexus
3. Filter out excluded resources (database, schema, or table level)
4. Enrich with descriptions
5. Build FAISS embeddings

### Frontend

#### 1. Service Layer
**File**: `frontend/src/services/ExclusionService.js`
- `getExclusions()` - Fetch all exclusions
- `addExclusion()` - Add new exclusion
- `removeExclusion()` - Remove exclusion
- `checkExclusion()` - Check if resource is excluded

**File**: `frontend/src/services/index.js`
- Exported `ExclusionService`

#### 2. UI Component
**File**: `frontend/src/components/DataIntelligence/SchemaOptimise.js`

**New Features**:
- **Visual Scope Indicators**:
  - Blue badge "Global" for descriptions and exclusions
  - Purple badge "User-level" for priority boost
  - Header legend explaining the difference

- **Hide/Show Section** in edit modal:
  - Shows current exclusion status
  - "Hide This [Database/Schema/Table]" button to add exclusion
  - "Show This [Database/Schema/Table]" button to remove exclusion
  - Clear messaging about global impact

- **State Management**:
  - Added `exclusions` state
  - `loadExclusions()` - Fetch exclusions on mount
  - `findExclusion()` - Find exclusion for a resource
  - `isExcluded()` - Check if resource is excluded (including parent-level)
  - `handleHideResource()` - Add exclusion
  - `handleShowResource()` - Remove exclusion

- **UI Improvements**:
  - Added `HiddenIcon` component
  - Scope badges on all sections (Description, Priority Boost, Visibility)
  - Contextual help text explaining global vs user-level
  - Color-coded exclusion section (red when hidden)

## User Experience

### Optimise Schema Screen
1. User clicks on any database, schema, or table
2. Modal opens with three sections:
   - **Description** (Global badge) - Add/edit description for all users
   - **Priority Boost** (User-level badge) - Boost for current user only
   - **Visibility** (Global badge) - Hide/show for all users

3. **To Hide a Resource**:
   - Click "Hide This [Database/Schema/Table]" button
   - Resource is removed from FAISS index
   - All users stop seeing it in AI recommendations
   - Success message confirms action

4. **To Show a Hidden Resource**:
   - Open the resource (it will show "Hidden from AI" status)
   - Click "Show This [Database/Schema/Table]" button
   - Resource is added back to FAISS index after refresh
   - All users will see it in AI recommendations again

### Visual Indicators
- **Header Legend**: Shows what "Global" and "User-level" mean
- **Scope Badges**: Clear indication on each feature
- **Help Text**: Explains impact of each action

## Security & Permissions
- All exclusion endpoints require **admin role**
- Only admins can hide/show resources
- Exclusions are tracked with `excluded_by` user ID for audit purposes

## Database Schema

```sql
CREATE TABLE nexus.schema_exclusions (
    id SERIAL PRIMARY KEY,
    catalog VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255),
    table_name VARCHAR(255),
    reason TEXT,
    excluded_by UUID NOT NULL REFERENCES nexus.users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT exclusion_hierarchy_check CHECK (...),
    CONSTRAINT unique_exclusion_path UNIQUE (catalog, schema_name, table_name)
);
```

## API Examples

### Add Exclusion (Hide)
```bash
POST /api/v1/exclusions
{
  "catalog": "supabase",
  "schema_name": "auth",
  "table_name": null,
  "reason": "Internal authentication tables"
}
```

### Remove Exclusion (Show)
```bash
DELETE /api/v1/exclusions/1
```

### List All Exclusions
```bash
GET /api/v1/exclusions
```

## Testing Checklist

### Backend
- [ ] Run database migration V020
- [ ] Test API endpoints:
  - [ ] GET /api/v1/exclusions
  - [ ] POST /api/v1/exclusions (database, schema, table levels)
  - [ ] DELETE /api/v1/exclusions/{id}
  - [ ] GET /api/v1/exclusions/check

### Schema Service
- [ ] Verify exclusions are fetched from Nexus
- [ ] Verify excluded resources are filtered out
- [ ] Verify FAISS index doesn't contain excluded resources
- [ ] Test refresh after removing exclusion

### Frontend
- [ ] Visual scope indicators appear correctly
- [ ] Hide button works for database/schema/table
- [ ] Show button works for hidden resources
- [ ] Success/error messages display correctly
- [ ] Exclusion status updates in real-time

## Future Enhancements
1. **Bulk Operations**: Hide/show multiple resources at once
2. **Exclusion Reasons**: Require reason when hiding resources
3. **Audit Log**: Track who hid/showed what and when
4. **Temporary Exclusions**: Set expiration dates for exclusions
5. **Exclusion Templates**: Pre-defined exclusion sets (e.g., "Hide all test schemas")

## Files Modified/Created

### Backend
- ✅ `nexus/db/migrations/V020__schema_exclusions.sql` (new)
- ✅ `nexus/app/database.py` (modified)
- ✅ `nexus/app/services/exclusion_service.py` (new)
- ✅ `nexus/app/api_exclusions.py` (new)
- ✅ `nexus/main.py` (modified)

### Schema Service
- ✅ `schema-service/schema_service.py` (modified)

### Frontend
- ✅ `frontend/src/services/ExclusionService.js` (new)
- ✅ `frontend/src/services/index.js` (modified)
- ✅ `frontend/src/components/DataIntelligence/SchemaOptimise.js` (modified)

## Notes
- Exclusions are **permanent** until manually removed
- Hiding a database excludes all its schemas and tables
- Hiding a schema excludes all its tables
- The feature is designed for **admin users only**
- Exclusions are stored in PostgreSQL, not in Trino
- Schema service fetches exclusions on every refresh (every 3-6 hours by default)
