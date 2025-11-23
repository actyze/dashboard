-- Nexus Service Database Schema
-- This schema is used by the Nexus FastAPI service for operational data
-- Tables are automatically created by SQLAlchemy models on startup

-- Create dedicated schema for Nexus service
CREATE SCHEMA IF NOT EXISTS nexus;

-- Set search path to include nexus schema
SET search_path TO nexus, public;

-- Users table (Nexus service authentication)
CREATE TABLE IF NOT EXISTS nexus.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User preferences table (Nexus service settings)
CREATE TABLE IF NOT EXISTS nexus.user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_preferences_user_id (user_id)
);

-- Conversation history table (Nexus service chat persistence)
CREATE TABLE IF NOT EXISTS nexus.conversation_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    message_type VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    message_content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation_history_user_id (user_id),
    INDEX idx_conversation_history_session_id (session_id)
);

-- Query history table (Nexus service query tracking)
CREATE TABLE IF NOT EXISTS nexus.query_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    natural_language_query TEXT NOT NULL,
    generated_sql TEXT,
    execution_status VARCHAR(20) NOT NULL, -- 'success', 'error', 'timeout'
    execution_time_ms INTEGER,
    row_count INTEGER,
    error_message TEXT,
    schema_recommendations JSONB,
    model_confidence DECIMAL(3,2),
    retry_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_history_user_id (user_id),
    INDEX idx_query_history_session_id (session_id),
    INDEX idx_query_history_status (execution_status)
);

-- Saved queries table (Nexus service user bookmarks)
CREATE TABLE IF NOT EXISTS nexus.saved_queries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    query_name VARCHAR(200) NOT NULL,
    description TEXT,
    natural_language_query TEXT NOT NULL,
    generated_sql TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT false,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_saved_queries_user_id (user_id),
    INDEX idx_saved_queries_favorite (is_favorite)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON nexus.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON nexus.users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON nexus.users(is_active);

-- Insert initial admin user for Nexus service
INSERT INTO nexus.users (username, email, full_name, is_active) VALUES
('nexus_admin', 'admin@nexus.local', 'Nexus Administrator', true)
ON CONFLICT (username) DO NOTHING;

-- Insert default preferences for admin user
INSERT INTO nexus.user_preferences (user_id, preference_key, preference_value) 
SELECT u.id, 'theme', '"dark"'::jsonb
FROM nexus.users u 
WHERE u.username = 'nexus_admin'
ON CONFLICT DO NOTHING;

INSERT INTO nexus.user_preferences (user_id, preference_key, preference_value) 
SELECT u.id, 'default_results_limit', '100'::jsonb
FROM nexus.users u 
WHERE u.username = 'nexus_admin'
ON CONFLICT DO NOTHING;

-- Grant permissions to nexus service user
-- Note: This will be executed with the credentials from values-dev-secrets.yaml
GRANT USAGE ON SCHEMA nexus TO nexus_service;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA nexus TO nexus_service;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA nexus TO nexus_service;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA nexus TO nexus_service;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA nexus GRANT ALL ON TABLES TO nexus_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA nexus GRANT ALL ON SEQUENCES TO nexus_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA nexus GRANT ALL ON FUNCTIONS TO nexus_service;
