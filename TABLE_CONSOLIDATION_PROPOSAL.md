# Table Consolidation Proposal

## Problem
We have 3 tables that overlap in functionality:
1. `conversation_history` - Stores chat messages (redundant)
2. `query_history` - Stores query executions (comprehensive)
3. `saved_queries` - Not implemented

## Proposed Changes

### Option 1: Remove `conversation_history` (Recommended)

**Rationale:**
- `query_history` already stores:
  - `natural_language_query` (user input)
  - `generated_sql` (assistant's generated SQL)
  - `model_reasoning` (LLM's explanation)
  - All execution details
- The "assistant response" in `conversation_history` is just:
  ```
  "Generated SQL: <sql>"
  ```
  Which is already in `query_history.generated_sql`

**Migration:**
```sql
-- Drop conversation_history table
DROP TABLE IF EXISTS nexus.conversation_history;
```

**Code Changes:**
- Remove `save_conversation_message()` calls from `orchestration_service.py` (lines 260-282)
- Remove `ConversationHistory` model from `database.py`
- Frontend can reconstruct chat UI from `query_history`:
  ```javascript
  // User message
  {
    type: 'user',
    content: query.natural_language_query,
    timestamp: query.generated_at
  }
  // Assistant message
  {
    type: 'assistant',
    content: `Here's your query:\n${query.generated_sql}\n\nReturned ${query.row_count} rows`,
    timestamp: query.executed_at
  }
  ```

### Option 2: Consolidate `saved_queries` into `query_history`

**Add to `query_history`:**
```sql
ALTER TABLE nexus.query_history 
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tags JSONB;

CREATE INDEX idx_query_history_favorites ON nexus.query_history(user_id, is_favorite) 
  WHERE is_favorite = TRUE;
```

**Then DROP `saved_queries`:**
```sql
DROP TABLE IF EXISTS nexus.saved_queries;
```

**Benefits:**
- Users can "favorite" any query from history
- No need to manually save - all queries auto-saved
- Can add tags to any historical query
- Simpler data model

## Recommended Final Schema

### Keep Only `query_history` with:

```sql
CREATE TABLE nexus.query_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES nexus.users(id),
    session_id VARCHAR(100),
    
    -- Query Details
    query_name VARCHAR(255),              -- User-provided name
    query_type VARCHAR(20),               -- 'natural_language' | 'manual'
    natural_language_query TEXT,
    generated_sql TEXT,
    
    -- Execution Details
    execution_status VARCHAR(20),
    execution_time_ms INTEGER,
    llm_response_time_ms INTEGER,
    row_count INTEGER,
    error_message TEXT,
    
    -- LLM Context
    model_reasoning TEXT,                 -- LLM's explanation
    schema_recommendations JSONB,
    chart_recommendation JSONB,
    model_confidence DECIMAL(3,2),
    retry_attempts INTEGER DEFAULT 0,
    
    -- User Features (NEW)
    is_favorite BOOLEAN DEFAULT FALSE,    -- Star/favorite queries
    tags JSONB,                           -- User-added tags
    description TEXT,                     -- User notes
    
    -- Timestamps
    generated_at TIMESTAMP,
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

## Implementation Steps

### Phase 1: Remove `conversation_history` (Quick Win)

1. **Migration Script**: `06-remove-conversation-history.sql`
   ```sql
   -- Backup first (optional)
   CREATE TABLE IF NOT EXISTS nexus.conversation_history_backup AS 
   SELECT * FROM nexus.conversation_history;
   
   -- Drop table
   DROP TABLE IF EXISTS nexus.conversation_history CASCADE;
   ```

2. **Code Cleanup**:
   - Remove from `orchestration_service.py`:
     ```python
     # DELETE these lines (260-282)
     await self.user_service.save_conversation_message(...)
     ```
   - Remove from `user_service.py`:
     ```python
     # DELETE save_conversation_message method
     ```
   - Remove from `database.py`:
     ```python
     # DELETE ConversationHistory model
     ```

### Phase 2: Add Favorites to `query_history`

1. **Migration Script**: `07-add-query-favorites.sql`
   ```sql
   ALTER TABLE nexus.query_history 
     ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS tags JSONB,
     ADD COLUMN IF NOT EXISTS description TEXT;
   
   CREATE INDEX idx_query_history_favorites 
   ON nexus.query_history(user_id, is_favorite) 
   WHERE is_favorite = TRUE;
   ```

2. **New API Endpoints**:
   ```python
   @router.patch("/query-history/{id}/favorite")
   async def toggle_favorite(query_id: int, is_favorite: bool):
       """Mark query as favorite"""
   
   @router.patch("/query-history/{id}/tags")
   async def update_tags(query_id: int, tags: List[str]):
       """Add tags to query"""
   
   @router.get("/query-history/favorites")
   async def get_favorites():
       """Get all favorite queries"""
   ```

### Phase 3: Remove `saved_queries` (Optional)

1. **Migration Script**: `08-remove-saved-queries.sql`
   ```sql
   -- Migrate any existing saved queries to favorites
   INSERT INTO nexus.query_history (
     user_id, query_name, query_type, natural_language_query, 
     generated_sql, is_favorite, tags, description
   )
   SELECT 
     user_id, query_name, 'natural_language', 
     natural_language_query, generated_sql, 
     TRUE, tags, description
   FROM nexus.saved_queries;
   
   DROP TABLE nexus.saved_queries CASCADE;
   ```

## Benefits

1. **Simpler Data Model**: 1 table instead of 3
2. **No Redundancy**: Single source of truth
3. **Better UX**: All queries in one place
4. **Performance**: Fewer joins, better indexes
5. **Easier Maintenance**: Less code, fewer bugs

## Alternative: Keep Them Separate

**If you want to keep conversation_history:**
- Use it ONLY for multi-turn conversations (like ChatGPT)
- Use `query_history` for execution audit
- Use `saved_queries` for templates/favorites

But honestly, for a SQL dashboard, **Option 1 (consolidate) is cleaner**.

## What Do You Think?

Should we:
- [ ] Remove `conversation_history` and use only `query_history`?
- [ ] Add favorites/tags to `query_history` and remove `saved_queries`?
- [ ] Keep all 3 tables but clarify their distinct purposes?

