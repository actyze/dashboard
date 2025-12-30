-- Nexus Service Database Schema
-- This schema is used by the Nexus FastAPI service for operational data
-- Tables are automatically created by SQLAlchemy models on startup

-- =====================================================
-- Create nexus schema if it doesn't exist
-- =====================================================
-- This ensures the schema exists without destroying existing data
CREATE SCHEMA IF NOT EXISTS nexus;

-- Set search path to include nexus schema
SET search_path TO nexus, public;

-- Enable UUID extension for robust ID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create flyway migration history table (needed for tracking migrations)
CREATE TABLE IF NOT EXISTS nexus.flyway_schema_history (
    installed_rank SERIAL PRIMARY KEY,
    version VARCHAR(50),
    description VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL,
    script VARCHAR(1000) NOT NULL,
    checksum BIGINT,
    installed_by VARCHAR(100) NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT NOW(),
    execution_time INTEGER NOT NULL,
    success BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS flyway_schema_history_s_idx ON nexus.flyway_schema_history (success);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION nexus.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Users table (Authentication identity)
CREATE TABLE IF NOT EXISTS nexus.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_users ON nexus.users;
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON nexus.users FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 2. Roles table (RBAC Definitions: ADMIN, EDITOR, VIEWER)
CREATE TABLE IF NOT EXISTS nexus.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_roles ON nexus.roles;
CREATE TRIGGER set_timestamp_roles BEFORE UPDATE ON nexus.roles FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 3. Groups table (Team/Organization units)
CREATE TABLE IF NOT EXISTS nexus.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_groups ON nexus.groups;
CREATE TRIGGER set_timestamp_groups BEFORE UPDATE ON nexus.groups FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 4. User Roles (Direct role assignment)
CREATE TABLE IF NOT EXISTS nexus.user_roles (
    user_id UUID REFERENCES nexus.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES nexus.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- 5. User Groups (Group membership)
CREATE TABLE IF NOT EXISTS nexus.user_groups (
    user_id UUID REFERENCES nexus.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES nexus.groups(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id)
);

-- 6. Group Roles (Roles inherited by all group members)
CREATE TABLE IF NOT EXISTS nexus.group_roles (
    group_id UUID REFERENCES nexus.groups(id) ON DELETE CASCADE,
    role_id UUID REFERENCES nexus.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, role_id)
);

-- 7. Refresh Tokens
CREATE TABLE IF NOT EXISTS nexus.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON nexus.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON nexus.refresh_tokens(token_hash);

-- 8. Dashboards (Visualizations)
CREATE TABLE IF NOT EXISTS nexus.dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    configuration JSONB NOT NULL, -- Layout, widgets, settings
    owner_user_id UUID REFERENCES nexus.users(id) ON DELETE SET NULL, -- Creator
    owner_group_id UUID REFERENCES nexus.groups(id) ON DELETE SET NULL, -- Access control group
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner_user ON nexus.dashboards(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner_group ON nexus.dashboards(owner_group_id);

DROP TRIGGER IF EXISTS set_timestamp_dashboards ON nexus.dashboards;
CREATE TRIGGER set_timestamp_dashboards BEFORE UPDATE ON nexus.dashboards FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 9. Saved Queries (SQL Snippets)
CREATE TABLE IF NOT EXISTS nexus.saved_queries (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE, -- Creator/Owner
    owner_group_id UUID REFERENCES nexus.groups(id) ON DELETE SET NULL, -- Shared with group
    query_name VARCHAR(200) NOT NULL,
    description TEXT,
    natural_language_query TEXT NOT NULL,
    generated_sql TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT false,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_saved_queries_user_id ON nexus.saved_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_group_id ON nexus.saved_queries(owner_group_id);

DROP TRIGGER IF EXISTS set_timestamp_saved_queries ON nexus.saved_queries;
CREATE TRIGGER set_timestamp_saved_queries BEFORE UPDATE ON nexus.saved_queries FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 10. User Preferences
CREATE TABLE IF NOT EXISTS nexus.user_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON nexus.user_preferences(user_id);

DROP TRIGGER IF EXISTS set_timestamp_user_preferences ON nexus.user_preferences;
CREATE TRIGGER set_timestamp_user_preferences BEFORE UPDATE ON nexus.user_preferences FOR EACH ROW EXECUTE PROCEDURE nexus.trigger_set_timestamp();

-- 11. Conversation History
CREATE TABLE IF NOT EXISTS nexus.conversation_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    message_type VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON nexus.conversation_history(user_id);

-- 12. Query History (Audit Log)
CREATE TABLE IF NOT EXISTS nexus.query_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    natural_language_query TEXT NOT NULL,
    generated_sql TEXT,
    execution_status VARCHAR(20) NOT NULL,
    execution_time_ms INTEGER,
    row_count INTEGER,
    error_message TEXT,
    schema_recommendations JSONB,
    model_confidence DECIMAL(3,2),
    retry_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON nexus.query_history(user_id);

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- 1. Create Default Roles
INSERT INTO nexus.roles (name, description) VALUES 
('ADMIN', 'Full global permissions: Manage users, groups, system config, billing'),
('EDITOR', 'Create/Edit/Delete dashboards and queries; Manage assigned groups'),
('VIEWER', 'Read-only access to dashboards and query execution')
ON CONFLICT (name) DO NOTHING;

-- 2. Create Bootstrap Admin User
-- Password: 'admin' (You should change this immediately!)
INSERT INTO nexus.users (username, email, password_hash, full_name, is_active) VALUES
('nexus_admin', 'admin@nexus.local', '$2b$12$sZ/ZbU/lagqbIzuS4OvYpunlX6vJoHQf37VB6X9ZnGakzCJdI09Qq', 'Nexus Administrator', true)
ON CONFLICT (username) DO NOTHING;

-- 3. Assign ADMIN Role to Bootstrap User
INSERT INTO nexus.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM nexus.users u, nexus.roles r
WHERE u.username = 'nexus_admin' AND r.name = 'ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 4. Create a Default Group (Optional Example)
INSERT INTO nexus.groups (name, description) VALUES
('General', 'Default group for all users')
ON CONFLICT (name) DO NOTHING;

-- 5. Default Preferences
INSERT INTO nexus.user_preferences (user_id, preference_key, preference_value) 
SELECT u.id, 'theme', '"dark"'::jsonb
FROM nexus.users u 
WHERE u.username = 'nexus_admin'
ON CONFLICT DO NOTHING;

-- Grant Permissions
GRANT USAGE ON SCHEMA nexus TO nexus_service;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA nexus TO nexus_service;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA nexus TO nexus_service;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA nexus TO nexus_service;

ALTER DEFAULT PRIVILEGES IN SCHEMA nexus GRANT ALL ON TABLES TO nexus_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA nexus GRANT ALL ON SEQUENCES TO nexus_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA nexus GRANT ALL ON FUNCTIONS TO nexus_service;
-- =====================================================================================
-- Intent Examples for ML-Based Intent Detection (DDL ONLY)
-- =====================================================================================
-- This table stores canonical examples for each intent category used by the
-- ML-based intent detector. Examples are encoded using MPNet and compared
-- against user queries using cosine similarity.
-- =====================================================================================

-- Create intent_examples table
CREATE TABLE IF NOT EXISTS nexus.intent_examples (
    id SERIAL PRIMARY KEY,
    intent VARCHAR(50) NOT NULL,
    example_text TEXT NOT NULL,
    category VARCHAR(50), -- Optional: sub-categorization (e.g., 'optimization', 'filtering', 'sorting')
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    notes TEXT -- Optional: explanation of when this example applies
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_intent_examples_intent ON nexus.intent_examples(intent) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_intent_examples_category ON nexus.intent_examples(intent, category) WHERE is_active = TRUE;

-- =====================================================================================
-- Add trigger for updated_at timestamp
-- =====================================================================================
CREATE OR REPLACE FUNCTION nexus.update_intent_examples_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_intent_examples_updated_at
    BEFORE UPDATE ON nexus.intent_examples
    FOR EACH ROW
    EXECUTE FUNCTION nexus.update_intent_examples_timestamp();

-- =====================================================================================
-- Create view for active examples grouped by intent
-- =====================================================================================
CREATE OR REPLACE VIEW nexus.active_intent_examples AS
SELECT 
    intent,
    COUNT(*) as example_count,
    ARRAY_AGG(example_text ORDER BY category, id) as examples,
    ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL) as categories
FROM nexus.intent_examples
WHERE is_active = TRUE
GROUP BY intent
ORDER BY intent;

-- =====================================================================================
-- Grant permissions
-- =====================================================================================
-- Note: Permissions already granted to nexus_service above, no need to grant here

-- =====================================================================================
-- Note: Intent example data (184 examples) is in DML script:
--       helm/dashboard/sql/dml/07-intent-examples-data.sql
--
-- Intent coverage:
-- - REFINE_RESULT: 48 examples (filtering, sorting, grouping, optimization, etc.)
-- - REJECT_RESULT: 28 examples (direct rejection, disagreement, error indication)
-- - EXPLAIN_RESULT: 30 examples (why/how/what questions, explanations)
-- - FOLLOW_UP_SAME_DOMAIN: 30 examples (breakdown, trend, comparison, detail)
-- - ACCEPT_RESULT: 33 examples (acceptance, gratitude, confirmation, satisfaction)
-- - NEW_QUERY: 15 examples (intentionally minimal as catch-all intent)
--
-- This separation allows easy updates without modifying schema
-- =====================================================================================
-- =====================================================================================
-- Intent Examples Data (DML)
-- =====================================================================================
-- Comprehensive intent examples for ML-based intent detection
-- Total: 184 examples across 6 intent categories
--
-- This file is safe to run multiple times (uses ON CONFLICT DO NOTHING)
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- REFINE_RESULT: User wants to modify, optimize, or adjust the current query
-- (48 examples)
-- ---------------------------------------------------------------------------------
INSERT INTO nexus.intent_examples (intent, example_text, category, notes) VALUES
-- Filtering refinements
('REFINE_RESULT', 'filter this to last 30 days', 'filtering', 'Add time-based filter'),
('REFINE_RESULT', 'show only values above 1000', 'filtering', 'Add numeric filter'),
('REFINE_RESULT', 'exclude inactive customers', 'filtering', 'Add exclusion filter'),
('REFINE_RESULT', 'only show active records', 'filtering', 'Status filter'),
('REFINE_RESULT', 'remove null values', 'filtering', 'Data cleaning'),
('REFINE_RESULT', 'filter by region', 'filtering', 'Add dimension filter'),

-- Sorting refinements
('REFINE_RESULT', 'sort by revenue', 'sorting', 'Change sort column'),
('REFINE_RESULT', 'order by date descending', 'sorting', 'Change sort order'),
('REFINE_RESULT', 'sort this alphabetically', 'sorting', 'Alphabetical sort'),
('REFINE_RESULT', 'order by most recent', 'sorting', 'Time-based sort'),

-- Grouping refinements
('REFINE_RESULT', 'group this by region', 'grouping', 'Add grouping'),
('REFINE_RESULT', 'aggregate by month', 'grouping', 'Time aggregation'),
('REFINE_RESULT', 'break this down by category', 'grouping', 'Add dimension breakdown'),
('REFINE_RESULT', 'group by customer', 'grouping', 'Entity grouping'),

-- Column refinements
('REFINE_RESULT', 'add a column for percentage', 'columns', 'Add calculated column'),
('REFINE_RESULT', 'include the customer name', 'columns', 'Add specific column'),
('REFINE_RESULT', 'remove the ID column', 'columns', 'Remove column'),
('REFINE_RESULT', 'show me more details', 'columns', 'Expand columns'),
('REFINE_RESULT', 'add email address', 'columns', 'Add specific field'),

-- Limiting refinements
('REFINE_RESULT', 'limit to top 10', 'limiting', 'Add LIMIT clause'),
('REFINE_RESULT', 'show only first 5 results', 'limiting', 'Reduce result set'),
('REFINE_RESULT', 'give me top 20', 'limiting', 'Top N results'),
('REFINE_RESULT', 'just show me a sample', 'limiting', 'Sample data'),

-- De-duplication refinements
('REFINE_RESULT', 'remove duplicates', 'deduplication', 'Add DISTINCT'),
('REFINE_RESULT', 'show unique values only', 'deduplication', 'Uniqueness filter'),
('REFINE_RESULT', 'deduplicate this', 'deduplication', 'Remove duplicates'),

-- Query optimization requests
('REFINE_RESULT', 'optimize this query', 'optimization', 'Performance optimization'),
('REFINE_RESULT', 'can you improve this query', 'optimization', 'General improvement'),
('REFINE_RESULT', 'make this query faster', 'optimization', 'Speed improvement'),
('REFINE_RESULT', 'suggest a better version', 'optimization', 'Better implementation'),
('REFINE_RESULT', 'optimize this for trino', 'optimization', 'Platform-specific optimization'),
('REFINE_RESULT', 'check the query and improve it', 'optimization', 'Review and improve'),
('REFINE_RESULT', 'is there a better way to write this', 'optimization', 'Alternative approach'),
('REFINE_RESULT', 'rewrite this query', 'optimization', 'Complete rewrite'),
('REFINE_RESULT', 'improve the performance', 'optimization', 'Performance tuning'),
('REFINE_RESULT', 'make this more efficient', 'optimization', 'Efficiency improvement'),
('REFINE_RESULT', 'can we speed this up', 'optimization', 'Speed focus'),
('REFINE_RESULT', 'optimize the joins', 'optimization', 'JOIN optimization'),
('REFINE_RESULT', 'use better indexing', 'optimization', 'Index hints'),
('REFINE_RESULT', 'make it run faster', 'optimization', 'Runtime improvement'),

-- General refinement phrases
('REFINE_RESULT', 'adjust the filters', 'general', 'Modify filters'),
('REFINE_RESULT', 'change the aggregation', 'general', 'Modify aggregation'),
('REFINE_RESULT', 'modify this', 'general', 'General modification'),
('REFINE_RESULT', 'tweak this a bit', 'general', 'Minor adjustments'),
('REFINE_RESULT', 'update the query', 'general', 'General update')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------
-- REJECT_RESULT: User is unhappy with the result and wants correction
-- (28 examples)
-- ---------------------------------------------------------------------------------
INSERT INTO nexus.intent_examples (intent, example_text, category, notes) VALUES
-- Direct rejection
('REJECT_RESULT', 'this is wrong', 'direct', 'Clear rejection'),
('REJECT_RESULT', 'incorrect', 'direct', 'Single word rejection'),
('REJECT_RESULT', 'this is not correct', 'direct', 'Explicit incorrectness'),
('REJECT_RESULT', 'wrong data', 'direct', 'Data incorrectness'),
('REJECT_RESULT', 'not right', 'direct', 'Informal rejection'),

-- Expressing confusion/disagreement
('REJECT_RESULT', 'I don''t like this result', 'disagreement', 'Dislike expression'),
('REJECT_RESULT', 'these numbers don''t make sense', 'disagreement', 'Logical inconsistency'),
('REJECT_RESULT', 'this doesn''t look right', 'disagreement', 'Visual/intuitive mismatch'),
('REJECT_RESULT', 'the data is incorrect', 'disagreement', 'Data quality issue'),
('REJECT_RESULT', 'something is off here', 'disagreement', 'Something wrong but unclear'),
('REJECT_RESULT', 'this can''t be correct', 'disagreement', 'Logically impossible'),
('REJECT_RESULT', 'that doesn''t match what I expected', 'disagreement', 'Expectation mismatch'),

-- Specific error indication
('REJECT_RESULT', 'I expected different numbers', 'expectation', 'Different expected result'),
('REJECT_RESULT', 'there''s an error in this', 'expectation', 'Error detected'),
('REJECT_RESULT', 'this is not what I asked for', 'expectation', 'Misunderstood request'),
('REJECT_RESULT', 'you misunderstood my question', 'expectation', 'Clarification needed'),
('REJECT_RESULT', 'this is the opposite of what I want', 'expectation', 'Completely wrong direction'),
('REJECT_RESULT', 'wrong columns', 'expectation', 'Column selection error'),
('REJECT_RESULT', 'wrong time period', 'expectation', 'Time filter error'),
('REJECT_RESULT', 'wrong calculation', 'expectation', 'Calculation logic error'),

-- Negative feedback
('REJECT_RESULT', 'no, that''s not it', 'negative', 'Negative confirmation'),
('REJECT_RESULT', 'not what I meant', 'negative', 'Misinterpretation'),
('REJECT_RESULT', 'nope', 'negative', 'Single word negative'),
('REJECT_RESULT', 'no', 'negative', 'Direct negative'),
('REJECT_RESULT', 'that''s incorrect', 'negative', 'Formal rejection'),

-- Polite rejection
('REJECT_RESULT', 'I think there might be an issue', 'polite', 'Soft rejection'),
('REJECT_RESULT', 'could you check this again', 'polite', 'Request for review'),
('REJECT_RESULT', 'something seems off', 'polite', 'Gentle concern'),
('REJECT_RESULT', 'I''m not sure this is right', 'polite', 'Uncertain rejection')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------
-- EXPLAIN_RESULT: User wants explanation or understanding of results
-- (30 examples)
-- ---------------------------------------------------------------------------------
INSERT INTO nexus.intent_examples (intent, example_text, category, notes) VALUES
-- Why questions
('EXPLAIN_RESULT', 'why is this number so high', 'why', 'Question about magnitude'),
('EXPLAIN_RESULT', 'why are there so few results', 'why', 'Question about count'),
('EXPLAIN_RESULT', 'why is customer X on top', 'why', 'Question about ranking'),
('EXPLAIN_RESULT', 'why did you choose these columns', 'why', 'Question about column selection'),
('EXPLAIN_RESULT', 'why this aggregation', 'why', 'Question about logic'),
('EXPLAIN_RESULT', 'why these tables', 'why', 'Question about table selection'),

-- How questions
('EXPLAIN_RESULT', 'how was this calculated', 'how', 'Calculation methodology'),
('EXPLAIN_RESULT', 'how did you get this number', 'how', 'Number derivation'),
('EXPLAIN_RESULT', 'how does this work', 'how', 'General mechanism'),
('EXPLAIN_RESULT', 'how are these joined', 'how', 'JOIN logic'),
('EXPLAIN_RESULT', 'how is this aggregated', 'how', 'Aggregation method'),

-- What questions
('EXPLAIN_RESULT', 'what does this mean', 'what', 'Interpretation request'),
('EXPLAIN_RESULT', 'what''s the logic behind this', 'what', 'Logic explanation'),
('EXPLAIN_RESULT', 'what am I looking at', 'what', 'Result interpretation'),
('EXPLAIN_RESULT', 'what does this column represent', 'what', 'Column meaning'),

-- Direct explanation requests
('EXPLAIN_RESULT', 'explain this result', 'direct', 'General explanation'),
('EXPLAIN_RESULT', 'can you clarify this', 'direct', 'Clarification request'),
('EXPLAIN_RESULT', 'break this down for me', 'direct', 'Detailed explanation'),
('EXPLAIN_RESULT', 'walk me through this', 'direct', 'Step-by-step explanation'),
('EXPLAIN_RESULT', 'help me understand this', 'direct', 'Understanding request'),

-- Source/origin questions
('EXPLAIN_RESULT', 'where does this data come from', 'source', 'Data source'),
('EXPLAIN_RESULT', 'which tables did you use', 'source', 'Table source'),
('EXPLAIN_RESULT', 'where are these numbers from', 'source', 'Number source'),

-- Methodology questions
('EXPLAIN_RESULT', 'what methodology did you use', 'methodology', 'Approach question'),
('EXPLAIN_RESULT', 'explain the calculation', 'methodology', 'Calculation details'),
('EXPLAIN_RESULT', 'how is this metric defined', 'methodology', 'Metric definition'),

-- Surprising result questions
('EXPLAIN_RESULT', 'this is surprising, why', 'surprising', 'Unexpected result'),
('EXPLAIN_RESULT', 'I didn''t expect this', 'surprising', 'Surprise expression'),
('EXPLAIN_RESULT', 'interesting, tell me more', 'surprising', 'Follow-up interest')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------
-- FOLLOW_UP_SAME_DOMAIN: User wants related analysis on same data
-- (30 examples)
-- ---------------------------------------------------------------------------------
INSERT INTO nexus.intent_examples (intent, example_text, category, notes) VALUES
-- Breakdown requests
('FOLLOW_UP_SAME_DOMAIN', 'now break it down by category', 'breakdown', 'Add dimension breakdown'),
('FOLLOW_UP_SAME_DOMAIN', 'show me the breakdown', 'breakdown', 'General breakdown'),
('FOLLOW_UP_SAME_DOMAIN', 'break this into subcategories', 'breakdown', 'Subcategory analysis'),
('FOLLOW_UP_SAME_DOMAIN', 'drill down by product', 'breakdown', 'Product-level detail'),
('FOLLOW_UP_SAME_DOMAIN', 'segment this by region', 'breakdown', 'Regional segmentation'),

-- Trend/temporal analysis
('FOLLOW_UP_SAME_DOMAIN', 'show trend for the same data', 'trend', 'Time series analysis'),
('FOLLOW_UP_SAME_DOMAIN', 'how does this look over time', 'trend', 'Temporal trend'),
('FOLLOW_UP_SAME_DOMAIN', 'show me the monthly trend', 'trend', 'Monthly aggregation'),
('FOLLOW_UP_SAME_DOMAIN', 'what''s the pattern', 'trend', 'Pattern identification'),

-- Comparison requests
('FOLLOW_UP_SAME_DOMAIN', 'compare this with last year', 'comparison', 'Year-over-year comparison'),
('FOLLOW_UP_SAME_DOMAIN', 'how does this compare to Q3', 'comparison', 'Quarterly comparison'),
('FOLLOW_UP_SAME_DOMAIN', 'show me last month for comparison', 'comparison', 'Comparative analysis'),
('FOLLOW_UP_SAME_DOMAIN', 'compare with previous period', 'comparison', 'Period comparison'),

-- Time period shifts
('FOLLOW_UP_SAME_DOMAIN', 'what about last month', 'time_shift', 'Previous month'),
('FOLLOW_UP_SAME_DOMAIN', 'now show me last quarter', 'time_shift', 'Previous quarter'),
('FOLLOW_UP_SAME_DOMAIN', 'what about yesterday', 'time_shift', 'Previous day'),
('FOLLOW_UP_SAME_DOMAIN', 'same for last year', 'time_shift', 'Previous year'),

-- Attribute addition
('FOLLOW_UP_SAME_DOMAIN', 'add revenue to this', 'attribute', 'Add metric'),
('FOLLOW_UP_SAME_DOMAIN', 'include customer names', 'attribute', 'Add dimension'),
('FOLLOW_UP_SAME_DOMAIN', 'also show profit margin', 'attribute', 'Add calculated field'),
('FOLLOW_UP_SAME_DOMAIN', 'include the addresses', 'attribute', 'Add detail field'),

-- Alternative views
('FOLLOW_UP_SAME_DOMAIN', 'how does this look by product', 'alternative_view', 'Different dimension'),
('FOLLOW_UP_SAME_DOMAIN', 'what if we group by state', 'alternative_view', 'Alternative grouping'),
('FOLLOW_UP_SAME_DOMAIN', 'show this by customer segment', 'alternative_view', 'Segmentation view'),

-- Detail requests
('FOLLOW_UP_SAME_DOMAIN', 'now show me the details', 'detail', 'Drill to detail'),
('FOLLOW_UP_SAME_DOMAIN', 'give me more detail', 'detail', 'Additional detail'),
('FOLLOW_UP_SAME_DOMAIN', 'expand this', 'detail', 'Expansion request'),

-- Continuing phrases
('FOLLOW_UP_SAME_DOMAIN', 'and also', 'continuation', 'Additive continuation'),
('FOLLOW_UP_SAME_DOMAIN', 'next, show me', 'continuation', 'Sequential continuation'),
('FOLLOW_UP_SAME_DOMAIN', 'additionally', 'continuation', 'Additional analysis')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------
-- ACCEPT_RESULT: User is satisfied with the result
-- (33 examples)
-- ---------------------------------------------------------------------------------
INSERT INTO nexus.intent_examples (intent, example_text, category, notes) VALUES
-- Direct acceptance
('ACCEPT_RESULT', 'this is good', 'direct', 'Positive affirmation'),
('ACCEPT_RESULT', 'looks perfect', 'direct', 'Perfect result'),
('ACCEPT_RESULT', 'that''s correct', 'direct', 'Correctness confirmation'),
('ACCEPT_RESULT', 'exactly what I needed', 'direct', 'Perfect match'),
('ACCEPT_RESULT', 'perfect', 'direct', 'Single word approval'),
('ACCEPT_RESULT', 'great', 'direct', 'Single word approval'),
('ACCEPT_RESULT', 'excellent', 'direct', 'Strong approval'),
('ACCEPT_RESULT', 'spot on', 'direct', 'Informal approval'),

-- Gratitude expressions
('ACCEPT_RESULT', 'thank you', 'gratitude', 'Thanks'),
('ACCEPT_RESULT', 'thanks', 'gratitude', 'Informal thanks'),
('ACCEPT_RESULT', 'appreciate it', 'gratitude', 'Appreciation'),
('ACCEPT_RESULT', 'thanks a lot', 'gratitude', 'Strong thanks'),

-- Confirmation phrases
('ACCEPT_RESULT', 'all good', 'confirmation', 'Everything fine'),
('ACCEPT_RESULT', 'this works', 'confirmation', 'Functional confirmation'),
('ACCEPT_RESULT', 'that works for me', 'confirmation', 'Personal confirmation'),
('ACCEPT_RESULT', 'good enough', 'confirmation', 'Acceptable result'),
('ACCEPT_RESULT', 'yes, this is right', 'confirmation', 'Correctness verification'),

-- Positive reactions
('ACCEPT_RESULT', 'nice', 'positive', 'Positive reaction'),
('ACCEPT_RESULT', 'awesome', 'positive', 'Strong positive'),
('ACCEPT_RESULT', 'wonderful', 'positive', 'Enthusiastic positive'),
('ACCEPT_RESULT', 'fantastic', 'positive', 'Very strong positive'),
('ACCEPT_RESULT', 'love it', 'positive', 'Strong approval'),

-- Agreement
('ACCEPT_RESULT', 'agreed', 'agreement', 'Explicit agreement'),
('ACCEPT_RESULT', 'I agree', 'agreement', 'Personal agreement'),
('ACCEPT_RESULT', 'yes', 'agreement', 'Simple yes'),
('ACCEPT_RESULT', 'yep', 'agreement', 'Informal yes'),
('ACCEPT_RESULT', 'correct', 'agreement', 'Correctness agreement'),

-- Satisfaction expressions
('ACCEPT_RESULT', 'satisfied', 'satisfaction', 'Satisfaction statement'),
('ACCEPT_RESULT', 'happy with this', 'satisfaction', 'Happiness expression'),
('ACCEPT_RESULT', 'looks good to me', 'satisfaction', 'Personal satisfaction'),
('ACCEPT_RESULT', 'that''ll do', 'satisfaction', 'Informal acceptance'),

-- Completion acknowledgment
('ACCEPT_RESULT', 'done', 'completion', 'Task complete'),
('ACCEPT_RESULT', 'that''s all', 'completion', 'Nothing more needed'),
('ACCEPT_RESULT', 'we''re good', 'completion', 'All finished')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------
-- NEW_QUERY: User starts a new, independent query
-- (15 examples - intentionally minimal as catch-all intent)
-- ---------------------------------------------------------------------------------
INSERT INTO nexus.intent_examples (intent, example_text, category, notes) VALUES
-- Data retrieval requests
('NEW_QUERY', 'show me total sales by region', 'retrieval', 'Aggregated data request'),
('NEW_QUERY', 'list top customers by revenue', 'retrieval', 'Ranked list request'),
('NEW_QUERY', 'what were last month''s orders', 'retrieval', 'Historical data request'),
('NEW_QUERY', 'get all products in inventory', 'retrieval', 'Full list request'),
('NEW_QUERY', 'display revenue trends', 'retrieval', 'Trend analysis request'),

-- Question format
('NEW_QUERY', 'how many orders were placed yesterday', 'question', 'Count question'),
('NEW_QUERY', 'what is the average order value', 'question', 'Calculation question'),
('NEW_QUERY', 'who are the top performers', 'question', 'Identification question'),
('NEW_QUERY', 'which products are low on stock', 'question', 'Filter question'),

-- Finding/searching
('NEW_QUERY', 'find customers who purchased in Q4', 'search', 'Conditional search'),
('NEW_QUERY', 'show me employee salaries', 'search', 'Specific data request'),
('NEW_QUERY', 'list all active users', 'search', 'Filtered list request'),

-- Fresh start indicators
('NEW_QUERY', 'new query', 'meta', 'Explicit new query'),
('NEW_QUERY', 'start over', 'meta', 'Reset conversation'),
('NEW_QUERY', 'different question', 'meta', 'Topic change')
ON CONFLICT DO NOTHING;

-- =====================================================================================
-- Summary
-- =====================================================================================
-- Total examples inserted: 184
-- - REFINE_RESULT: 48 (filtering, sorting, grouping, optimization, etc.)
-- - REJECT_RESULT: 28 (rejection, disagreement, error indication)
-- - EXPLAIN_RESULT: 30 (why/how/what questions, explanations)
-- - FOLLOW_UP_SAME_DOMAIN: 30 (breakdown, trend, comparison)
-- - ACCEPT_RESULT: 33 (acceptance, gratitude, confirmation)
-- - NEW_QUERY: 15 (minimal, as catch-all intent)
-- =====================================================================================

