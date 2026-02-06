-- ============================================================================
-- VERIFY INTEGRITY (Health Check)
-- ============================================================================
-- Checks for violations of v3.0 Strict Invariants.
-- Expected Result: 0 violations for all checks.

SELECT 
    'Orphan API Keys' as check_name,
    (SELECT COUNT(*) FROM api_keys WHERE owner_user_id IS NULL) as violation_count,
    'Must be 0 (Strict FK)' as expected
UNION ALL
SELECT 
    'Orphan Bills',
    (SELECT COUNT(*) FROM bills WHERE user_id IS NULL),
    'Must be 0 (Strict FK)'
UNION ALL
SELECT 
    'Mixed Case Wallets',
    (SELECT COUNT(*) FROM users WHERE wallet_address != LOWER(wallet_address)),
    'Must be 0 (Strict Check)'
UNION ALL
SELECT 
    'Invalid Usage Scope',
    (SELECT COUNT(*) FROM usage_events WHERE scope != 'api_key' OR api_key_id IS NULL),
    'Must be 0 (Strict Usage Model)'
UNION ALL
SELECT 
    'Missing System Key',
    (CASE WHEN EXISTS (SELECT 1 FROM api_keys WHERE prefix = 'sys_') THEN 0 ELSE 1 END),
    'Must be 0 (System Key Required)';

-- Snapshot of Critical Metrics
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM api_keys) as total_keys,
    (SELECT COUNT(*) FROM usage_events) as total_usage_events,
    (SELECT COUNT(*) FROM bills) as total_bills;

