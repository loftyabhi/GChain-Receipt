-- ============================================================================
-- TXPROOF CANONICAL MASTER SCHEMA
-- ============================================================================
-- DESCRIPTION: Single source of truth for TxProof SaaS & Registry Platform.
-- VERSION: 2.2 (Consolidated)
-- DATE: 2026-02-04
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

-- 3.2 API KEYS
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE, -- SHA-256
    prefix TEXT NOT NULL,          -- tx_p_live_... (TxProof branded)
    name TEXT,
    owner_id TEXT,                 -- Wallet Address (Legacy, kept for backward compat)
    owner_user_id UUID,            -- Link to Users.id (Modern - ALWAYS SET)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner_user ON api_keys(owner_user_id);

-- -----------------------------------------------------------------------------
-- 4. BUSINESS DATA (Users & Records)
-- -----------------------------------------------------------------------------

-- 4.1 USERS (Modern Enterprise Profiles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    is_email_verified BOOLEAN DEFAULT FALSE,
    primary_api_key_id UUID REFERENCES api_keys(id),
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
CREATE INDEX IF NOT EXISTS idx_users_primary_api_key ON users(primary_api_key_id);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status) WHERE account_status != 'active';
CREATE UNIQUE INDEX IF NOT EXISTS unique_verified_email ON users (LOWER(email)) WHERE is_email_verified = true;

CREATE UNIQUE INDEX IF NOT EXISTS unique_verified_email ON users (LOWER(email)) WHERE is_email_verified = true;

-- 4.1.1 LATE BINDING CONSTRAINTS (Resolve Circular Dependencies)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_owner_user'
    ) THEN
        ALTER TABLE api_keys 
        ADD CONSTRAINT fk_owner_user 
        FOREIGN KEY (owner_user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- 4.2 EMAIL VERIFICATION TOKENS
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
    user_id UUID,          -- Supabase Internal ID (Modern - preferred)
    user_address TEXT,     -- Wallet Address (Legacy, kept for backward compat)
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
    CONSTRAINT bills_tx_chain_unique UNIQUE (tx_hash, chain_id),
    
    -- Foreign key for user tracking
    CONSTRAINT fk_bills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bills_tx_hash ON bills(tx_hash, chain_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_created ON bills(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_user_address ON bills(user_address) WHERE user_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_expires ON bills(expires_at);
CREATE INDEX IF NOT EXISTS idx_bills_api_key ON bills(api_key_id);

-- -----------------------------------------------------------------------------
-- 5. ASYNC & QUEUE SYSTEMS
-- -----------------------------------------------------------------------------

-- 5.1 WEBHOOKS (Encrypted configs)
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret_encrypted TEXT NOT NULL,
    secret_iv TEXT NOT NULL,
    secret_tag TEXT NOT NULL,
    secret_last4 TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT webhooks_url_check CHECK (url ~ '^https://.*')
);

-- 5.2 WEBHOOK EVENTS (Delivery log)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
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
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
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
    CONSTRAINT usage_events_scope_check 
        CHECK ((scope = 'api_key' AND api_key_id IS NOT NULL) OR (scope = 'user' AND user_id IS NOT NULL))
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
    CONSTRAINT usage_aggregates_scope_check
        CHECK (
            (scope = 'api_key' AND api_key_id IS NOT NULL AND user_id IS NULL) 
            OR (scope = 'user' AND user_id IS NOT NULL AND api_key_id IS NULL)
            OR (scope = 'public' AND user_id IS NULL AND api_key_id IS NULL)
        )
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
-- 7. SECURITY & RLS POLICIES
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

-- 7.1 Public Read Policies
CREATE POLICY "Public Read Plans" ON plans FOR SELECT USING (TRUE);
CREATE POLICY "Public Read Chains" ON chains FOR SELECT USING (TRUE);
CREATE POLICY "Public Read Ads" ON ad_profiles FOR SELECT USING (is_active = true AND is_deleted = false);
CREATE POLICY "Public Read Contributors" ON contributors FOR SELECT USING (TRUE);
CREATE POLICY "Public Read Tokens" ON supported_tokens FOR SELECT USING (is_active = true);

-- 7.2 Authenticated User Policies
CREATE POLICY "Users view own keys" ON api_keys 
    FOR SELECT TO authenticated 
    USING (owner_id = auth.uid()::TEXT OR owner_user_id::text = auth.uid()::text);

CREATE POLICY "Users view own bills" ON bills 
    FOR SELECT TO authenticated 
    USING (user_address = auth.uid()::TEXT OR user_id = auth.uid());

CREATE POLICY "Users read own profile" ON users
    FOR SELECT TO authenticated
    USING (wallet_address = auth.uid()::text OR id::text = auth.uid()::text);

-- 7.3 Service Role (Backend) & Direct Connection Policies
-- These policies allow BOTH Supabase Service Role (JWT) and Direct Postgres Connections (Service Role User)
CREATE POLICY "Service manages everything" ON bills FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages usage_events" ON usage_events FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages usage_aggregates" ON usage_aggregates FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages jobs" ON bill_jobs FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages webhooks" ON webhooks FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages templates" ON receipt_templates FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages ads" ON ad_profiles FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages plans" ON plans FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages chains" ON chains FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages keys" ON api_keys FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages users" ON users FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages contributors" ON contributors FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages nonces" ON auth_nonces FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

CREATE POLICY "Service manages verification_tokens" ON email_verification_tokens FOR ALL 
    USING (auth.role() = 'service_role' OR current_user = 'postgres' OR current_user = 'postgres.avklfjqhpizielvnkwyh');

-- 7.4 EXPLICIT GRANTS (Ensures permission denied errors are resolved)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. RPC FUNCTIONS & STORED PROCEDURES
-- -----------------------------------------------------------------------------

-- 8.1 ATOMIC JOB CLAIM (Concurrency Safe)
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

-- 8.2 QUOTA INCREMENT (Unified Scope)
CREATE OR REPLACE FUNCTION increment_usage(
    p_scope usage_scope_type,
    p_id UUID,
    p_cost INT DEFAULT 1
)
RETURNS TABLE (allowed BOOLEAN, used INT, limit_val INT, remaining INT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_limit INT := 1000; -- Fallback
    v_current INT;
    v_month DATE := DATE_TRUNC('month', NOW())::DATE;
BEGIN
    -- Resolve Limit based on Scope
    IF p_scope = 'api_key' THEN
        SELECT COALESCE(k.quota_limit, p.monthly_quota, 100) INTO v_limit 
        FROM api_keys k LEFT JOIN plans p ON k.plan_id = p.id 
        WHERE k.id = p_id;
    ELSIF p_scope = 'user' THEN
        -- Strict User Quota: Override > Monthly > Default
        SELECT COALESCE(u.quota_override, u.monthly_quota, 1000) INTO v_limit
        FROM users u
        WHERE u.id = p_id;
    END IF;

    -- Upsert Aggregate
    IF p_scope = 'api_key' THEN
        INSERT INTO usage_aggregates (scope, api_key_id, period_start, request_count)
        VALUES ('api_key', p_id, v_month, p_cost)
        ON CONFLICT (api_key_id, period_start) WHERE scope = 'api_key'
        DO UPDATE SET request_count = usage_aggregates.request_count + p_cost
        RETURNING request_count INTO v_current;
    ELSE
        INSERT INTO usage_aggregates (scope, user_id, period_start, request_count)
        VALUES ('user', p_id, v_month, p_cost)
        ON CONFLICT (user_id, period_start) WHERE scope = 'user'
        DO UPDATE SET request_count = usage_aggregates.request_count + p_cost
        RETURNING request_count INTO v_current;
    END IF;

    RETURN QUERY SELECT (v_current <= v_limit), v_current, v_limit, (v_limit - v_current);
END;
$$;

-- Legacy shim for increment_api_usage
CREATE OR REPLACE FUNCTION increment_api_usage(p_key_id UUID, p_cost INT DEFAULT 1)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
    v_quota INT; v_current INT; v_month DATE := DATE_TRUNC('month', NOW())::DATE;
BEGIN
    SELECT p.monthly_quota INTO v_quota FROM api_keys k JOIN plans p ON k.plan_id = p.id WHERE k.id = p_key_id;
    INSERT INTO usage_aggregates (api_key_id, period_start, request_count, scope)
    VALUES (p_key_id, v_month, p_cost, 'api_key')
    ON CONFLICT (api_key_id, period_start) WHERE scope = 'api_key'
    DO UPDATE SET request_count = usage_aggregates.request_count + p_cost
    RETURNING request_count INTO v_current;
    RETURN v_current <= v_quota;
END;
$$;

-- 8.3 AGGREGATION HELPERS
CREATE OR REPLACE FUNCTION aggregate_usage_by_endpoint(p_api_key_id UUID, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS TABLE (endpoint TEXT, request_count BIGINT, avg_duration_ms NUMERIC, error_rate NUMERIC) AS $$
BEGIN
    RETURN QUERY SELECT au.endpoint, COUNT(*), ROUND(AVG(au.duration_ms), 2),
    ROUND((COUNT(*) FILTER (WHERE au.status_code >= 400)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2)
    FROM api_usage au WHERE au.api_key_id = p_api_key_id AND au.created_at >= p_start_date AND au.created_at <= p_end_date
    GROUP BY au.endpoint ORDER BY request_count DESC;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 9. TRIGGERS & MAINTENANCE
-- -----------------------------------------------------------------------------

-- Apply auto-timestamp triggers
CREATE TRIGGER chains_updated_at BEFORE UPDATE ON chains FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER bill_jobs_updated_at BEFORE UPDATE ON bill_jobs FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Contributor aggregation logic
CREATE OR REPLACE FUNCTION update_contributors() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contributors (wallet_address, chain_id, total_amount_wei, contribution_count, last_contribution_at)
  VALUES (NEW.donor_address, NEW.chain_id, NEW.amount_wei, 1, NEW.block_timestamp)
  ON CONFLICT (wallet_address, chain_id)
  DO UPDATE SET
    total_amount_wei = contributors.total_amount_wei + NEW.amount_wei,
    contribution_count = contributors.contribution_count + 1,
    last_contribution_at = GREATEST(contributors.last_contribution_at, NEW.block_timestamp),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contributors AFTER INSERT ON contributor_events 
FOR EACH ROW EXECUTE FUNCTION update_contributors();

-- Maintenance view for SLA
CREATE OR REPLACE VIEW daily_metrics AS
SELECT DATE_TRUNC('hour', finished_at) AS hour_bucket,
AVG(duration_ms) as avg_latency,
COUNT(*) FILTER (WHERE status = 'failed') AS failure_count,
COUNT(*) AS total_count
FROM bill_jobs WHERE finished_at > NOW() - INTERVAL '24 hours' GROUP BY 1;

-- ============================================================================
-- 10. EMAIL OPERATIONS & MARKETING
-- ============================================================================

-- 10.1 USER PREFERENCES (Extension)
-- Columns added to users table in 4.1 section above.


-- 10.2 EMAIL TEMPLATES (Admin Managed)
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

-- Insert standard verification template
INSERT INTO email_templates (name, subject, html_content, category, sender_type, is_active)
VALUES (
    'admin-verification', 
    'Verify Your Email - TxProof Developers',
    '<h1 style="margin: 0; margin-bottom: 24px; font-size: 28px; font-weight: 700; color: #ffffff;">Verify your email to activate your TxProof account</h1><p style="margin: 0; margin-bottom: 32px; font-size: 16px; line-height: 1.6; color: #bbbbbb;">Hi there,<br><br>You''re one step away from using TxProof to generate verifiable blockchain receipts and production-ready transaction proofs.<br><br>Confirm your email address to activate your developer account and start issuing cryptographically secure receipts.</p><div align="center" style="margin-bottom: 32px;"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{verifyUrl}}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="24%" stroke="f" fillcolor="#7c3aed"><w:anchorlock/><center><![endif]--><a href="{{verifyUrl}}" class="hover-bg-violet-500" style="background-color: #7c3aed; border-radius: 12px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 700; line-height: 52px; text-align: center; text-decoration: none; width: 240px; -webkit-text-size-adjust: none;">Activate My Account</a><!--[if mso]></center></v:roundrect><![endif]--></div><p style="margin: 0; margin-bottom: 32px; font-size: 14px; line-height: 1.6; color: #666666; text-align: center;">For security, this link expires in <strong>{{expiryMinutes}} minutes</strong>.</p><div style="background-color: #1a1a1a; border-radius: 12px; padding: 16px; margin-bottom: 0;"><p style="margin: 0; font-size: 12px; color: #888888; word-break: break-all;"><strong>If the button doesn’t work, copy and open this link in your browser:</strong><br><br><a href="{{verifyUrl}}" style="color: #7c3aed; text-decoration: none;">{{verifyUrl}}</a></p></div>',
    'transactional',
    'verify',
    true
)
ON CONFLICT (name) DO UPDATE SET 
    html_content = EXCLUDED.html_content,
    subject = EXCLUDED.subject;

-- 10.3 EMAIL JOBS (Priority Queue with Analytics)
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
    
    -- Scheduling & Stats
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    attempt_count INT DEFAULT 0,
    
    -- Analytics
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Snapshot (Audit)
    rendered_html TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Queue Performance & Analytics
CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON email_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_jobs_user ON email_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_jobs_priority ON email_jobs(priority, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_jobs_analytics ON email_jobs(opened_at, clicked_at);

-- 10.4 RLS POLICIES

-- Templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage templates" ON email_templates;
CREATE POLICY "Admins manage templates" ON email_templates
    FOR ALL
    USING (auth.role() = 'service_role' OR current_user = 'postgres');

DROP POLICY IF EXISTS "Public read templates" ON email_templates;
CREATE POLICY "Public read templates" ON email_templates
    FOR SELECT
    USING (true);

-- Jobs
ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service manages email jobs" ON email_jobs;
CREATE POLICY "Service manages email jobs" ON email_jobs
    FOR ALL
    USING (auth.role() = 'service_role' OR current_user = 'postgres');

DROP POLICY IF EXISTS "Users view own email history" ON email_jobs;
CREATE POLICY "Users view own email history" ON email_jobs
    FOR SELECT
    USING (user_id = auth.uid());

-- 10.5 ATOMIC JOB CLAIM FUNCTION (Priority Aware)
CREATE OR REPLACE FUNCTION claim_next_email_job()
RETURNS TABLE (id UUID, recipient_email TEXT, category TEXT, template_id UUID, metadata JSONB, rendered_html TEXT) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_job_id UUID;
BEGIN
    SELECT email_jobs.id INTO v_job_id
    FROM email_jobs
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
    ORDER BY 
        CASE 
            WHEN priority = 'high' THEN 1 
            WHEN priority = 'normal' THEN 2 
            WHEN priority = 'low' THEN 3 
            ELSE 2 
        END ASC,
        scheduled_at ASC, 
        created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
        UPDATE email_jobs
        SET status = 'processing',
            started_at = NOW(),
            attempt_count = attempt_count + 1,
            updated_at = NOW()
        WHERE email_jobs.id = v_job_id;
        
        RETURN QUERY 
            SELECT email_jobs.id, email_jobs.recipient_email, email_jobs.category, 
                   email_jobs.template_id, email_jobs.metadata, email_jobs.rendered_html
            FROM email_jobs 
            WHERE email_jobs.id = v_job_id;
    END IF;
END;
$$;

-- 10.6 TRIGGERS
DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS email_jobs_updated_at ON email_jobs;
CREATE TRIGGER email_jobs_updated_at BEFORE UPDATE ON email_jobs FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 10.7 GRANTS
GRANT ALL ON TABLE public.email_templates TO service_role;
GRANT ALL ON TABLE public.email_jobs TO service_role;
GRANT ALL ON TABLE public.users TO service_role;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
UPDATE users 
SET allow_promotional_emails = TRUE 
WHERE allow_promotional_emails IS NULL AND account_status = 'active';
