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
GRANT SELECT ON nexus.intent_examples TO nexus_app;
GRANT SELECT ON nexus.active_intent_examples TO nexus_app;

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
