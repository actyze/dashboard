-- Semantic Relationship Graph
-- Stores table-to-table relationships with join conditions for intelligent query generation
-- Three-layer population: inferred (naming conventions), mined (query history), admin (manual)

CREATE TABLE IF NOT EXISTS nexus.table_relationships (
    id SERIAL PRIMARY KEY,
    source_catalog VARCHAR(255) NOT NULL,
    source_schema VARCHAR(255) NOT NULL,
    source_table VARCHAR(255) NOT NULL,
    target_catalog VARCHAR(255) NOT NULL,
    target_schema VARCHAR(255) NOT NULL,
    target_table VARCHAR(255) NOT NULL,
    join_condition TEXT NOT NULL,
    relationship_type VARCHAR(10) NOT NULL DEFAULT '1:N',
    source_method VARCHAR(20) NOT NULL DEFAULT 'inferred',
    confidence FLOAT NOT NULL DEFAULT 0.5,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP,
    created_by UUID REFERENCES nexus.users(id),
    updated_by UUID REFERENCES nexus.users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_rel_type CHECK (relationship_type IN ('1:1','1:N','N:1','M:N')),
    CONSTRAINT valid_source CHECK (source_method IN ('inferred','mined','admin')),
    CONSTRAINT confidence_range CHECK (confidence BETWEEN 0.0 AND 1.0),
    CONSTRAINT no_self_ref CHECK (NOT (source_catalog=target_catalog AND source_schema=target_schema AND source_table=target_table)),
    CONSTRAINT unique_relationship UNIQUE (source_catalog,source_schema,source_table,target_catalog,target_schema,target_table,join_condition)
);

CREATE TABLE IF NOT EXISTS nexus.relationship_audit_log (
    id SERIAL PRIMARY KEY,
    relationship_id INTEGER NOT NULL REFERENCES nexus.table_relationships(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID NOT NULL REFERENCES nexus.users(id),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON nexus.table_relationships(source_catalog,source_schema,source_table);
CREATE INDEX IF NOT EXISTS idx_rel_target ON nexus.table_relationships(target_catalog,target_schema,target_table);
CREATE INDEX IF NOT EXISTS idx_rel_active ON nexus.table_relationships(is_disabled,confidence DESC) WHERE NOT is_disabled;
CREATE INDEX IF NOT EXISTS idx_rel_method ON nexus.table_relationships(source_method);
CREATE INDEX IF NOT EXISTS idx_audit_rel_id ON nexus.relationship_audit_log(relationship_id);
