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

