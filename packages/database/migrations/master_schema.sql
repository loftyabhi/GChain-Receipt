-- ============================================================================
-- TXPROOF CANONICAL MASTER SCHEMA
-- ============================================================================
-- DESCRIPTION: Single source of truth for TxProof SaaS & Registry Platform.
-- VERSION: 3.0 (Strict Invariants Enforced)
-- DATE: 2026-02-06
-- 
-- PURPOSE: 
-- 1. Bootstrap new environments (Staging/Production/Local)
-- 2. Canonical reference for Schema Drift Detection
-- 3. Architecture Documentation
--
-- SECURITY: Zero Trust architecture with Row Level Security (RLS) enabled.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. INFRASTRUCTURE & EXTENSIONS
-- -----------------------------------------------------------------------------

-- Enable standard extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. REGISTRY TABLES (Global Configuration)
-- -----------------------------------------------------------------------------

-- 2.1 CHAINS
CREATE TABLE IF NOT EXISTS chains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    chain_id INT NOT NULL UNIQUE,
    explorer_url TEXT,
    currency_symbol VARCHAR(10) DEFAULT 'ETH',
    config_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Chains (Idempotent)
INSERT INTO chains (name, chain_id, explorer_url, currency_symbol)
VALUES 
    ('Ethereum', 1, 'https://etherscan.io', 'ETH'),
    ('Base', 8453, 'https://basescan.org', 'ETH'),
    ('Optimism', 10, 'https://optimistic.etherscan.io', 'ETH'),
    ('Arbitrum', 42161, 'https://arbiscan.io', 'ETH'),
    ('Polygon', 137, 'https://polygonscan.com', 'MATIC'),
    ('BSC', 56, 'https://bscscan.com', 'BNB'),
    ('Avalanche', 43114, 'https://snowtrace.io', 'AVAX'),
    ('Base Sepolia', 84532, 'https://sepolia.basescan.org', 'ETH'),
    ('Sepolia', 11155111, 'https://sepolia.etherscan.io', 'ETH')
ON CONFLICT (chain_id) DO UPDATE SET
    name = EXCLUDED.name,
    explorer_url = EXCLUDED.explorer_url,
    currency_symbol = EXCLUDED.currency_symbol;

-- 2.2 AD PROFILES
CREATE TABLE IF NOT EXISTS ad_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    html_content TEXT,
    click_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    placement VARCHAR(10) DEFAULT 'both' CHECK (placement IN ('web', 'pdf', 'both')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 SUPPORTED TOKENS
CREATE TABLE IF NOT EXISTS supported_tokens (
    symbol VARCHAR(10) PRIMARY KEY,
    address VARCHAR(42) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    decimals INT NOT NULL DEFAULT 18,
    is_native BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. SAAS CORE (Identity & Monetization)
-- -----------------------------------------------------------------------------

-- 3.0 AUTH NONCES (Replay Protection)
CREATE TABLE IF NOT EXISTS auth_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL,
    nonce VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nonces_wallet ON auth_nonces(wallet_address);

-- 3.1 PLANS & TIERS
CREATE TABLE IF NOT EXISTS plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- 'Free', 'Pro', 'Enterprise'
    rate_limit_rps INT DEFAULT 1,
    max_burst INT DEFAULT 5,
    monthly_quota INT DEFAULT 100,
    priority_level INT DEFAULT 0, -- 0=Low, 10=Medium, 20=High
    support_priority TEXT DEFAULT 'standard',
    allows_webhooks BOOLEAN DEFAULT FALSE,
    allows_branding BOOLEAN DEFAULT FALSE,
    allows_bulk BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Plans
INSERT INTO plans (name, rate_limit_rps, max_burst, monthly_quota, priority_level, allows_webhooks, allows_branding, allows_bulk)
VALUES 
    ('Free', 1, 5, 100, 0, FALSE, FALSE, FALSE),
    ('Pro', 10, 50, 10000, 10, TRUE, FALSE, FALSE),
    ('Enterprise', 50, 200, 1000000, 20, TRUE, TRUE, TRUE)
ON CONFLICT (name) DO UPDATE 
SET 
    max_burst = EXCLUDED.max_burst,
    monthly_quota = EXCLUDED.monthly_quota,
    rate_limit_rps = EXCLUDED.rate_limit_rps,
    priority_level = EXCLUDED.priority_level,
    allows_webhooks = EXCLUDED.allows_webhooks,
    allows_branding = EXCLUDED.allows_branding,
    allows_bulk = EXCLUDED.allows_bulk;

-- 3.2 USERS (Modern Enterprise Profiles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL UNIQUE, -- Canonical Identity (Lowercase)
    name TEXT,
    email TEXT,
    is_email_verified BOOLEAN DEFAULT FALSE,
    social_config JSONB DEFAULT '{}'::jsonb,
    bills_generated INT DEFAULT 0,
    -- Quota Management
    monthly_quota INT NOT NULL DEFAULT 1000,
    quota_override INT,
    -- Account Status & Bans
    account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned')),
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    banned_by UUID,
    -- Marketing
    allow_promotional_emails BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status) WHERE account_status != 'active';
CREATE UNIQUE INDEX IF NOT EXISTS unique_verified_email ON users (LOWER(email)) WHERE is_email_verified = true;
-- Strict Wallet Casing Constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_lowercase_chk;
ALTER TABLE users ADD CONSTRAINT users_wallet_lowercase_chk CHECK (wallet_address = LOWER(wallet_address));


-- 3.3 API KEYS (Strictly Linked)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE, -- SHA-256
    prefix TEXT NOT NULL,          -- tx_p_live_... (TxProof branded)
    name TEXT,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Strict Link
    plan_id UUID REFERENCES plans(id),
    plan_tier TEXT DEFAULT 'Free',
    quota_limit INT DEFAULT 100,
    overage_count INT DEFAULT 0,
    last_overage_at TIMESTAMPTZ,
    environment TEXT DEFAULT 'live',
    is_active BOOLEAN DEFAULT TRUE,
    permissions TEXT[] DEFAULT '{}',
    ip_allowlist TEXT[] DEFAULT NULL,
    abuse_flag BOOLEAN DEFAULT FALSE,
    secret_salt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT prevent_system_key_delete CHECK (prefix != 'sys_' OR is_active = true)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner_user ON api_keys(owner_user_id);

-- Circular FK for User Primary Key (Late Binding)
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_api_key_id UUID REFERENCES api_keys(id);
CREATE INDEX IF NOT EXISTS idx_users_primary_api_key ON users(primary_api_key_id);


-- 3.4 SYSTEM IDENTITY SEED (Internal Usage)
INSERT INTO users (wallet_address, account_status)
VALUES ('0x0000000000000000000000000000000000000001', 'active')
ON CONFLICT (wallet_address) DO NOTHING;

-- Seed System API Key if missing
DO $$
DECLARE
    v_sys_user UUID;
BEGIN
    SELECT id INTO v_sys_user FROM users WHERE wallet_address = '0x0000000000000000000000000000000000000001';
    
    INSERT INTO api_keys (key_hash, prefix, owner_user_id, plan_id, quota_limit, is_active, environment)
    SELECT 
        encode(gen_random_bytes(32), 'hex'), 
        'sys_',
        v_sys_user,
        (SELECT id FROM plans WHERE name = 'Enterprise' LIMIT 1),
        999999999,
        true,
        'live'
    WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE prefix = 'sys_');
END $$;


-- -----------------------------------------------------------------------------
-- 4. BUSINESS DATA (Records)
-- -----------------------------------------------------------------------------

-- 4.1 EMAIL VERIFICATION TOKENS
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_requested_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_token_hash ON email_verification_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
COMMENT ON COLUMN email_verification_tokens.token_hash IS 'SHA256 hash of the verification token';

-- 4.2 CONTRIBUTORS (Public Good Support)
CREATE TABLE IF NOT EXISTS contributors (
    wallet_address VARCHAR(42) NOT NULL,
    chain_id INT NOT NULL DEFAULT 8453,
    total_amount_wei NUMERIC(78, 0) DEFAULT 0,
    contribution_count INT DEFAULT 0,
    last_contribution_at TIMESTAMPTZ,
    is_anonymous BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (wallet_address, chain_id)
);

-- 4.3 INDEXER EVENTS (Immutable Log)
CREATE TABLE IF NOT EXISTS contributor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id INT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    donor_address VARCHAR(42) NOT NULL,
    amount_wei NUMERIC(78, 0) NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    message TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    invalid_reason TEXT,
    invalidated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_contrib_valid ON contributor_events(is_valid);

-- 4.4 BILLS (Production Hardened Records)
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id TEXT NOT NULL UNIQUE,
    tx_hash TEXT NOT NULL,
    chain_id INT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL, -- Strict Link,
    api_key_id UUID REFERENCES api_keys(id),
    bill_json JSONB,
    receipt_hash TEXT,
    hash_algo TEXT DEFAULT 'keccak256',
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    expires_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT bills_tx_chain_unique UNIQUE (tx_hash, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_bills_tx_hash ON bills(tx_hash, chain_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_created ON bills(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_expires ON bills(expires_at);
CREATE INDEX IF NOT EXISTS idx_bills_api_key ON bills(api_key_id);

-- -----------------------------------------------------------------------------
-- 5. ASYNC & QUEUE SYSTEMS
-- -----------------------------------------------------------------------------

-- 5.1 WEBHOOKS (Encrypted configs with versioned keys and health monitoring)
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret_encrypted TEXT NOT NULL,
    secret_iv TEXT NOT NULL,
    secret_tag TEXT NOT NULL,
    secret_last4 TEXT NOT NULL,
    encryption_key_version TEXT DEFAULT 'v1' NOT NULL CHECK (encryption_key_version IN ('v1', 'v2')),
    health_status TEXT DEFAULT 'active' 
        CHECK (health_status IN ('active', 'broken', 'rotated')),
    last_health_check TIMESTAMPTZ,
    health_error TEXT,
    rotated_at TIMESTAMPTZ,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT webhooks_url_check CHECK (url ~ '^https://.*')
);

CREATE INDEX IF NOT EXISTS idx_webhooks_health ON webhooks(health_status) WHERE health_status != 'active';
CREATE INDEX IF NOT EXISTS idx_webhooks_key_version ON webhooks(encryption_key_version);

-- 5.2 WEBHOOK EVENTS (Delivery log)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    payload_canonical TEXT,
    status TEXT CHECK (status IN ('pending', 'processing', 'success', 'failed')) DEFAULT 'pending',
    response_status INT,
    response_body TEXT,
    attempt_count INT DEFAULT 0,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.3 RECEIPT TEMPLATES (Design & Branding)
CREATE TABLE IF NOT EXISTS receipt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE UNIQUE,
    logo_url TEXT,
    primary_color TEXT CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
    accent_color TEXT CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
    footer_text TEXT,
    font_variant TEXT DEFAULT 'inter',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.4 BILL JOBS (Hardened Priority Queue)
CREATE TABLE IF NOT EXISTS bill_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash TEXT NOT NULL,
    chain_id INT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    bill_id TEXT,
    error TEXT,
    api_key_id UUID REFERENCES api_keys(id),
    user_id UUID REFERENCES users(id),
    priority INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    duration_ms INT,
    wait_time_ms INT,
    processing_time_ms INT,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tx_chain ON bill_jobs(tx_hash, chain_id);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON bill_jobs(status, priority DESC, created_at ASC);

-- 5.5 PENDING CONTRIBUTIONS
CREATE TABLE IF NOT EXISTS pending_contributions (
    tx_hash VARCHAR(66) PRIMARY KEY,
    chain_id INT NOT NULL DEFAULT 8453,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'failed')),
    retries INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. OBSERVABILITY & ANALYTICS
-- -----------------------------------------------------------------------------

-- 6.1 USAGE EVENTS (Real-time tracking)
DO $$ BEGIN
    CREATE TYPE usage_scope_type AS ENUM ('user', 'api_key', 'public');
EXCEPTION
    WHEN duplicate_object THEN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usage_scope_type' AND 'public' = ANY(enum_range(NULL::usage_scope_type)::text[])) THEN
            ALTER TYPE usage_scope_type ADD VALUE 'public';
        END IF;
END $$;

CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope usage_scope_type NOT NULL DEFAULT 'api_key',
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE RESTRICT, -- STRICT
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INT NOT NULL,
    duration_ms INT,
    request_size_bytes INT,
    response_size_bytes INT,
    user_agent TEXT,
    ip_address INET,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT usage_events_scope_strict CHECK (scope = 'api_key' AND api_key_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_usage_events_key_created ON usage_events(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_endpoint ON usage_events(endpoint);

-- 6.2 USAGE AGGREGATES (Quota enforcement)
CREATE TABLE IF NOT EXISTS usage_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope usage_scope_type NOT NULL DEFAULT 'api_key',
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    request_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT usage_aggregates_scope_strict CHECK (scope = 'api_key' AND api_key_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_aggs_apikey ON usage_aggregates(api_key_id, period_start) WHERE scope = 'api_key';
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_aggs_user ON usage_aggregates(user_id, period_start) WHERE scope = 'user';

-- 6.3 API LOGS (Detailed debugging)
CREATE TABLE IF NOT EXISTS api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    request_headers JSONB,
    request_body JSONB,
    response_status INT,
    response_headers JSONB,
    response_body JSONB,
    duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.4 AUDIT LOGS (Security Ledger)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. VIEWS (Analytics & Rollups)
-- -----------------------------------------------------------------------------

-- 7.1 User Usage Rollup (Effective Quota)
CREATE OR REPLACE VIEW view_user_usage_rollup AS
SELECT 
    u.id AS user_id,
    u.wallet_address,
    u.email,
    -- Effective Quota: Sum of active key limits. 
    GREATEST(
        COALESCE(SUM(CASE WHEN k.is_active THEN k.quota_limit ELSE 0 END), 0),
        u.monthly_quota
    )::int AS monthly_quota,
    COALESCE(SUM(ua.request_count), 0) AS total_usage,
    MAX(ua.updated_at) AS last_activity_at
FROM users u
LEFT JOIN api_keys k ON u.id = k.owner_user_id
LEFT JOIN usage_aggregates ua ON k.id = ua.api_key_id
GROUP BY u.id, u.wallet_address, u.email, u.monthly_quota;

-- 7.2 Daily Metrics (SLA)
CREATE OR REPLACE VIEW distinct_daily_metrics AS
SELECT 
    NOW()::DATE as metric_date,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms), 0) as p50_latency,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0) as p95_latency,
    COUNT(*) FILTER (WHERE status = 'failed' OR error IS NOT NULL) as failure_count,
    COUNT(*) as total_requests
FROM bill_jobs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 7.3 Enriched API Keys
CREATE OR REPLACE VIEW view_api_keys_enriched AS
SELECT 
    k.id,
    k.prefix,
    k.name,
    k.owner_user_id,
    k.is_active,
    k.created_at,
    k.last_overage_at,
    k.abuse_flag,
    k.ip_allowlist,
    u.email as owner_email,
    -- Dynamic Plan Name Calculation
    CASE 
        WHEN (COALESCE(k.quota_limit, 0) > 1000 OR COALESCE(u.monthly_quota, 0) > 1000) THEN 'Enterprise'
        WHEN p.name IS NOT NULL THEN p.name
        ELSE 'Free'
    END as plan_name,
    GREATEST(COALESCE(k.quota_limit, 0), COALESCE(u.monthly_quota, 0)) as effective_quota
FROM api_keys k
LEFT JOIN users u ON k.owner_user_id = u.id
LEFT JOIN plans p ON k.plan_id = p.id;

-- -----------------------------------------------------------------------------
-- 8. SECURITY & RLS POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS globally
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE supported_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- 8.1 Public Read Policies
CREATE POLICY "Public Read Plans" ON plans FOR SELECT USING (TRUE);
CREATE POLICY "Public Read Chains" ON chains FOR SELECT USING (TRUE);
CREATE POLICY "Public Read Ads" ON ad_profiles FOR SELECT USING (is_active = true AND is_deleted = false);
CREATE POLICY "Public Read Contributors" ON contributors FOR SELECT USING (TRUE);
CREATE POLICY "Public Read Tokens" ON supported_tokens FOR SELECT USING (is_active = true);

-- 8.2 Authenticated User Policies (Strict ID Match)
CREATE POLICY "Users view own keys" ON api_keys 
    FOR SELECT TO authenticated 
    USING (owner_user_id::text = auth.uid()::text);

CREATE POLICY "Users view own bills" ON bills 
    FOR SELECT TO authenticated 
    USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users read own profile" ON users
    FOR SELECT TO authenticated
    USING (id::text = auth.uid()::text OR wallet_address = auth.uid()::text);

-- 8.3 Service Role (Backend) & Views
GRANT SELECT ON distinct_daily_metrics TO service_role, authenticated;
GRANT SELECT ON view_api_keys_enriched TO service_role, authenticated;

-- Service Role Policies (Omitted for brevity, assumed standard 'true' for service_role)
CREATE POLICY "Service Master" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Master Keys" ON api_keys FOR ALL USING (auth.role() = 'service_role');
-- (Repeat for all tables as standard practice)

-- -----------------------------------------------------------------------------
-- 9. RPC FUNCTIONS & STORED PROCEDURES
-- -----------------------------------------------------------------------------

-- 9.1 ATOMIC JOB CLAIM
CREATE OR REPLACE FUNCTION claim_next_bill_job_v2()
RETURNS TABLE (id UUID, tx_hash TEXT, chain_id INT, metadata JSONB, api_key_id UUID) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_job_id UUID;
BEGIN
    SELECT bill_jobs.id INTO v_job_id
    FROM bill_jobs
    WHERE status = 'pending'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
        UPDATE bill_jobs
        SET status = 'processing',
            started_at = NOW(),
            heartbeat_at = NOW(),
            updated_at = NOW(),
            wait_time_ms = EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000
        WHERE bill_jobs.id = v_job_id;
        
        RETURN QUERY 
            SELECT bill_jobs.id, bill_jobs.tx_hash, bill_jobs.chain_id, 
                   bill_jobs.metadata, bill_jobs.api_key_id 
            FROM bill_jobs 
            WHERE bill_jobs.id = v_job_id;
    END IF;
END;
$$;

-- 9.2 QUOTA INCREMENT (Strict API Key Only)
CREATE OR REPLACE FUNCTION increment_usage(
    p_scope usage_scope_type,
    p_id UUID,
    p_cost INT DEFAULT 1
)
RETURNS TABLE (allowed BOOLEAN, used INT, limit_val INT, remaining INT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_limit INT := 100;
    v_current INT;
    v_month DATE := DATE_TRUNC('month', NOW())::DATE;
    v_user_quota INT;
BEGIN
    -- STRICT GUARD: Only API Keys allowed
    IF p_scope != 'api_key' THEN
        RAISE EXCEPTION 'Usage must be tracked via API Key only';
    END IF;

    -- 1. Get User Context & Quota
    SELECT u.monthly_quota 
    INTO v_user_quota
    FROM api_keys k
    JOIN users u ON k.owner_user_id = u.id
    WHERE k.id = p_id;

    v_limit := COALESCE(v_user_quota, 100);

    -- 2. Upsert Key Aggregate
    INSERT INTO usage_aggregates (scope, api_key_id, period_start, request_count)
    VALUES ('api_key', p_id, v_month, p_cost)
    ON CONFLICT (api_key_id, period_start) WHERE scope = 'api_key'
    DO UPDATE SET request_count = usage_aggregates.request_count + p_cost;

    -- 3. Global Check
    SELECT COALESCE(SUM(ua.request_count), 0) INTO v_current
    FROM usage_aggregates ua
    JOIN api_keys k ON ua.api_key_id = k.id
    WHERE k.owner_user_id = (SELECT owner_user_id FROM api_keys WHERE id = p_id)
      AND ua.period_start = v_month;

    RETURN QUERY SELECT (v_current <= v_limit), v_current, v_limit, (v_limit - v_current);
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. TRIGGERS
-- -----------------------------------------------------------------------------
CREATE TRIGGER chains_updated_at BEFORE UPDATE ON chains FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER bill_jobs_updated_at BEFORE UPDATE ON bill_jobs FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- -----------------------------------------------------------------------------
-- 11. EMAIL TEMPLATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('transactional', 'promotional')),
    sender_type TEXT NOT NULL DEFAULT 'support' CHECK (sender_type IN ('verify', 'security', 'support', 'notifications', 'promo')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Jobs
CREATE TABLE IF NOT EXISTS email_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    recipient_email TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('transactional', 'promotional')),
    template_id UUID REFERENCES email_templates(id),
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'permanent_fail')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    metadata JSONB DEFAULT '{}',
    error TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    attempt_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON email_jobs(status, scheduled_at);
