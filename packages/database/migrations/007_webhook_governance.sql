-- ============================================================================
-- WEBHOOK GOVERNANCE MIGRATION
-- ============================================================================
-- PURPOSE: Add versioned encryption and health monitoring to webhooks
-- VERSION: 007
-- DATE: 2026-02-07
-- SAFETY: Backward compatible, all columns have defaults
-- ============================================================================

-- Add governance columns to webhooks table
ALTER TABLE webhooks 
ADD COLUMN IF NOT EXISTS encryption_key_version TEXT DEFAULT 'v1' NOT NULL CHECK (encryption_key_version IN ('v1', 'v2')),
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'active' 
    CHECK (health_status IN ('active', 'broken', 'rotated')),
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS health_error TEXT,
ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

-- Add canonical payload storage to events for debugging
ALTER TABLE webhook_events
ADD COLUMN IF NOT EXISTS payload_canonical TEXT;

-- Performance indexes for health queries
CREATE INDEX IF NOT EXISTS idx_webhooks_health 
    ON webhooks(health_status) 
    WHERE health_status != 'active';

CREATE INDEX IF NOT EXISTS idx_webhooks_key_version 
    ON webhooks(encryption_key_version);

-- Documentation comments
COMMENT ON COLUMN webhooks.encryption_key_version IS 
    'Version of WEBHOOK_ENCRYPTION_KEY used to encrypt secret (e.g. v1, v2). Enables key rotation without breaking existing webhooks.';

COMMENT ON COLUMN webhooks.health_status IS 
    'Operational status: active=working correctly, broken=failed integrity check, rotated=secret has been replaced';

COMMENT ON COLUMN webhooks.last_health_check IS 
    'Timestamp of last successful secret decryption and integrity verification';

COMMENT ON COLUMN webhooks.health_error IS 
    'Error message if health_status is broken (e.g. "Secret integrity check failed - last4 mismatch")';

COMMENT ON COLUMN webhooks.rotated_at IS 
    'Timestamp when secret was last rotated';

-- Verify migration
DO $$
BEGIN
    -- Ensure all existing webhooks have default values
    UPDATE webhooks 
    SET 
        encryption_key_version = 'v1',
        health_status = 'active',
        last_health_check = NOW()
    WHERE encryption_key_version IS NULL 
       OR health_status IS NULL;
    
    RAISE NOTICE 'Webhook governance migration completed successfully';
END $$;
