-- Migration: Fix user_id type from INTEGER to UUID
-- Changes generate_upload_table_name function to accept UUID

-- Drop and recreate function with correct UUID type
CREATE OR REPLACE FUNCTION nexus.generate_upload_table_name(
    p_user_id UUID,
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
        -- Use first 8 chars of UUID for uniqueness
        v_base := 'upload_' || substring(replace(p_user_id::text, '-', ''), 1, 8) || '_' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MISS');
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

