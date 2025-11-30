-- Nexus Service Database Schema
-- This schema is used by the Nexus FastAPI service for operational data
-- Tables are automatically created by SQLAlchemy models on startup

-- Create dedicated schema for Nexus service
CREATE SCHEMA IF NOT EXISTS nexus;

-- Set search path to include nexus schema
SET search_path TO nexus, public;

-- Enable UUID extension for robust ID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
