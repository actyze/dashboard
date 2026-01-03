-- Migration: User Uploads Schema and Metadata Tracking
-- Creates schema for user-uploaded data and tracks upload metadata

-- Create dedicated schema for user uploads
CREATE SCHEMA IF NOT EXISTS user_uploads;

-- Grant permissions to nexus service user
GRANT USAGE ON SCHEMA user_uploads TO nexus_service;
GRANT CREATE ON SCHEMA user_uploads TO nexus_service;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA user_uploads TO nexus_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA user_uploads GRANT ALL ON TABLES TO nexus_service;

-- Uploads metadata table (tracks all uploaded files and their tables)
CREATE TABLE IF NOT EXISTS nexus.user_upload_metadata (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES nexus.users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'csv', 'excel'
    upload_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Table information
    schema_name VARCHAR(63) NOT NULL DEFAULT 'user_uploads',
    table_name VARCHAR(63) NOT NULL,
    sheet_name VARCHAR(255), -- For Excel files with multiple sheets
    row_count INTEGER,
    column_count INTEGER,
    
    -- Lifecycle management
    is_temporary BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP, -- When temp table should be cleaned up
    retention_days INTEGER DEFAULT 1, -- Configurable 1-7 days
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'processing', -- 'processing', 'active', 'failed', 'expired', 'deleted'
    error_message TEXT,
    
    -- Metadata
    column_definitions JSONB, -- Store column names and types
    sample_data JSONB, -- First few rows for preview
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_user_upload_metadata_user_id ON nexus.user_upload_metadata(user_id);
CREATE INDEX idx_user_upload_metadata_table_name ON nexus.user_upload_metadata(schema_name, table_name);
CREATE INDEX idx_user_upload_metadata_status ON nexus.user_upload_metadata(status);
CREATE INDEX idx_user_upload_metadata_expires_at ON nexus.user_upload_metadata(expires_at) WHERE is_temporary = TRUE;
CREATE INDEX idx_user_upload_metadata_deleted_at ON nexus.user_upload_metadata(deleted_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION nexus.update_user_upload_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamps
CREATE TRIGGER trigger_update_user_upload_metadata_timestamp
    BEFORE UPDATE ON nexus.user_upload_metadata
    FOR EACH ROW
    EXECUTE FUNCTION nexus.update_user_upload_metadata_timestamp();

-- Function to generate unique table name
CREATE OR REPLACE FUNCTION nexus.generate_upload_table_name(
    p_user_id INTEGER,
    p_base_name VARCHAR(63) DEFAULT NULL
)
RETURNS VARCHAR(63) AS $$
DECLARE
    v_table_name VARCHAR(63);
    v_counter INTEGER := 1;
    v_base VARCHAR(50);
BEGIN
    -- Use provided base name or generate from user_id and timestamp
    IF p_base_name IS NOT NULL THEN
        v_base := regexp_replace(lower(p_base_name), '[^a-z0-9_]', '_', 'g');
        v_base := substring(v_base, 1, 40);
    ELSE
        v_base := 'upload_' || p_user_id || '_' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MISS');
    END IF;
    
    v_table_name := v_base;
    
    -- Ensure uniqueness
    WHILE EXISTS (
        SELECT 1 FROM nexus.user_upload_metadata 
        WHERE table_name = v_table_name 
        AND status != 'deleted'
    ) LOOP
        v_counter := v_counter + 1;
        v_table_name := v_base || '_' || v_counter;
    END LOOP;
    
    RETURN v_table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to mark expired temporary tables
CREATE OR REPLACE FUNCTION nexus.mark_expired_temporary_tables()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE nexus.user_upload_metadata
    SET status = 'expired',
        updated_at = CURRENT_TIMESTAMP
    WHERE is_temporary = TRUE
        AND status = 'active'
        AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Comment documentation
COMMENT ON SCHEMA user_uploads IS 'Schema for user-uploaded CSV and Excel data files';
COMMENT ON TABLE nexus.user_upload_metadata IS 'Tracks metadata for all user-uploaded files and their corresponding tables';
COMMENT ON COLUMN nexus.user_upload_metadata.is_temporary IS 'If true, table will be automatically cleaned up after retention period';
COMMENT ON COLUMN nexus.user_upload_metadata.retention_days IS 'Number of days to retain temporary tables (1-7 days)';
COMMENT ON COLUMN nexus.user_upload_metadata.expires_at IS 'Timestamp when temporary table should be cleaned up';
COMMENT ON FUNCTION nexus.generate_upload_table_name IS 'Generates unique table name for uploaded data';
COMMENT ON FUNCTION nexus.mark_expired_temporary_tables IS 'Marks temporary tables as expired when past retention period';

