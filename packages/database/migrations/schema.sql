-- Database Schema for Chain Receipt
-- Full Consolidated Schema (Includes Indexer, Ad Placement, and Hardening)

-----------------------------------------------------------------------------
-- 0. CLEANUP (Optional - Use with Caution)
-- -----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS contributor_events CASCADE;
-- DROP TABLE IF EXISTS indexer_state CASCADE;
-- DROP TABLE IF EXISTS contributors CASCADE;
-- DROP TABLE IF EXISTS bills CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS ad_profiles CASCADE;
-- DROP TABLE IF EXISTS chains CASCADE;

-- -----------------------------------------------------------------------------
-- 1. CHAINS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    chain_id INT NOT NULL UNIQUE,
    explorer_url TEXT,
    currency_symbol VARCHAR(10) DEFAULT 'ETH',
    config_json JSONB DEFAULT '{}'
);

-- Seed Initial Chains (Idempotent)
INSERT INTO chains (name, chain_id, explorer_url, currency_symbol)
VALUES 
    -- Mainnets
    ('Ethereum', 1, 'https://etherscan.io', 'ETH'),
    ('Base', 8453, 'https://basescan.org', 'ETH'),
    ('Optimism', 10, 'https://optimistic.etherscan.io', 'ETH'),
    ('Arbitrum', 42161, 'https://arbiscan.io', 'ETH'),
    ('Polygon', 137, 'https://polygonscan.com', 'MATIC'),
    ('BSC', 56, 'https://bscscan.com', 'BNB'),
    ('Avalanche', 43114, 'https://snowtrace.io', 'AVAX'),
    -- Testnets
    ('Base Sepolia', 84532, 'https://sepolia.basescan.org', 'ETH'),
    ('Sepolia', 11155111, 'https://sepolia.etherscan.io', 'ETH')
ON CONFLICT (chain_id) DO UPDATE SET
    name = EXCLUDED.name,
    explorer_url = EXCLUDED.explorer_url,
    currency_symbol = EXCLUDED.currency_symbol;

-- -----------------------------------------------------------------------------
-- 2. USERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    wallet_address VARCHAR(42) PRIMARY KEY,
    bills_generated INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. ADS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    html_content TEXT,
    click_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    -- [NEW] Placement Column
    placement VARCHAR(10) DEFAULT 'both' CHECK (placement IN ('web', 'pdf', 'both'))
);

-- -----------------------------------------------------------------------------
-- 4. BILLS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) REFERENCES users(wallet_address),
    tx_hash VARCHAR(66) NOT NULL,
    chain_id INT REFERENCES chains(chain_id),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    bill_json JSONB,
    system_audit_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 5. CONTRIBUTORS (Public Good Support)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributors (
    wallet_address VARCHAR(42) NOT NULL,
    chain_id INT NOT NULL DEFAULT 8453, -- Default to Base Mainnet
    total_amount_wei NUMERIC(78, 0) DEFAULT 0,
    contribution_count INT DEFAULT 0,
    last_contribution_at TIMESTAMP,
    is_anonymous BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wallet_address, chain_id)
);

-- -----------------------------------------------------------------------------
-- 6. INDEXER STATE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indexer_state (
    key VARCHAR(50),
    chain_id INT NOT NULL DEFAULT 8453,
    last_synced_block BIGINT NOT NULL CHECK (last_synced_block >= 0),
    -- [NEW] Parallel & Observability Columns
    locked_until TIMESTAMP,
    owner_id VARCHAR(50),
    leased_from_block BIGINT,
    leased_to_block BIGINT,
    last_success_at TIMESTAMP,
    last_attempt_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (key, chain_id)
);

-- Seed Initial Indexer State
-- [FIX] Use 0 (Genesis) or Deployment Block. Do NOT force update on conflict.
INSERT INTO indexer_state (key, chain_id, last_synced_block)
VALUES ('contributors_sync', 8453, 0)
ON CONFLICT (key, chain_id) 
DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. INDEXER EVENTS (Immutable Log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id INT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMP,
    donor_address VARCHAR(42) NOT NULL,
    amount_wei NUMERIC(78, 0) NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, tx_hash, log_index)
);

-- -----------------------------------------------------------------------------
-- INDEXES & CONSTRAINTS
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bills_wallet ON bills(wallet_address);
CREATE INDEX IF NOT EXISTS idx_bills_tx ON bills(tx_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bill_tx_chain ON bills(tx_hash, chain_id);
CREATE INDEX IF NOT EXISTS idx_bills_chain ON bills(chain_id);
CREATE INDEX IF NOT EXISTS idx_contributors_total ON contributors(total_amount_wei DESC);

-- FK Hook
DO $$ BEGIN
    -- ALTER TABLE users ADD CONSTRAINT fk_users_plan FOREIGN KEY (current_plan_id) REFERENCES plans(id);
    -- Constraint removed as plans table is deleted
    NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 9. SUPPORTED TOKENS (Dynamic List)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supported_tokens (
    symbol VARCHAR(10) PRIMARY KEY,
    address VARCHAR(42) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    decimals INT NOT NULL DEFAULT 18,
    is_native BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE supported_tokens ENABLE ROW LEVEL SECURITY;

-- Public can view active tokens
DROP POLICY IF EXISTS "Public can view active tokens" ON supported_tokens;
CREATE POLICY "Public can view active tokens" ON supported_tokens FOR SELECT USING (is_active = true);

-- -----------------------------------------------------------------------------
-- TRIGGERS & FUNCTIONS
-- -----------------------------------------------------------------------------

-- 1. Timestamp Auto-Update
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Immutability Guards
CREATE OR REPLACE FUNCTION prevent_wallet_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'wallet_address is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_bill_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND OLD.bill_json IS DISTINCT FROM NEW.bill_json THEN
      RAISE EXCEPTION 'bill_json is immutable after completion';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS no_wallet_update ON users;
CREATE TRIGGER no_wallet_update BEFORE UPDATE OF wallet_address ON users FOR EACH ROW EXECUTE FUNCTION prevent_wallet_update();

DROP TRIGGER IF EXISTS bills_updated_at ON bills;
CREATE TRIGGER bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS no_bill_rewrite ON bills;
CREATE TRIGGER no_bill_rewrite BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION prevent_bill_update();

-- 3. Contributor Aggregation Trigger
CREATE OR REPLACE FUNCTION update_contributors() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contributors (wallet_address, chain_id, total_amount_wei, contribution_count, last_contribution_at, is_anonymous, updated_at)
  VALUES (NEW.donor_address, NEW.chain_id, NEW.amount_wei, 1, NEW.block_timestamp, NEW.is_anonymous, NOW())
  ON CONFLICT (wallet_address, chain_id)
  DO UPDATE SET
    total_amount_wei = contributors.total_amount_wei + NEW.amount_wei,
    contribution_count = contributors.contribution_count + 1,
    -- [SAFETY] Prevent out-of-order execution from overwriting newer timestamps
    last_contribution_at = GREATEST(contributors.last_contribution_at, NEW.block_timestamp),
    is_anonymous = NEW.is_anonymous, 
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_contributors ON contributor_events;
CREATE TRIGGER trg_update_contributors AFTER INSERT ON contributor_events FOR EACH ROW EXECUTE FUNCTION update_contributors();

-- 4. [NEW] Claim Scan Lease RPC
-- returns { allowed: boolean, start_block: bigint, end_block: bigint, message: text }
CREATE OR REPLACE FUNCTION claim_indexer_scan(
    p_chain_id INT,
    p_key VARCHAR,
    p_owner_id VARCHAR,
    p_force BOOLEAN,
    p_batch_size INT DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
    v_state RECORD;
    v_now TIMESTAMP := NOW();
    v_lease_duration INTERVAL := '15 minutes'; -- Enterprise safety (cold starts/lag)
    v_throttle_interval INTERVAL := '6 hours';
    v_start_block BIGINT;
BEGIN
    -- 1. Get State (Lock)
    SELECT * INTO v_state FROM indexer_state 
    WHERE key = p_key AND chain_id = p_chain_id FOR UPDATE; 

    -- [CRITICAL] Fail if state missing. Manual Init Required.
    IF v_state IS NULL THEN
        RAISE EXCEPTION 'Indexer state not initialized for key % chain %. Run migration.', p_key, p_chain_id;
    END IF;

    -- 2. SAFETY CHECK: Strict Locking
    IF v_state.locked_until IS NOT NULL 
       AND v_state.locked_until > v_now 
       AND v_state.owner_id IS DISTINCT FROM p_owner_id THEN
         RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'LOCKED_BY_OTHER',
            'locked_until', v_state.locked_until,
            'current_owner', v_state.owner_id
        );
    END IF;

    -- 3. THROTTLE CHECK: Rate Limiting
    -- Check time since last SUCCESS, not last attempt.
    IF NOT p_force 
       AND (v_state.owner_id IS DISTINCT FROM p_owner_id)
       AND (v_state.last_success_at IS NOT NULL)
       AND (v_now - v_state.last_success_at < v_throttle_interval) THEN
         RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'THROTTLED',
            'next_run_at', v_state.last_success_at + v_throttle_interval
        );
    END IF;

    -- 4. GRANT LEASE
    v_start_block := v_state.last_synced_block;
    
    UPDATE indexer_state 
    SET locked_until = v_now + v_lease_duration,
        owner_id = p_owner_id,
        updated_at = v_now,
        last_attempt_at = v_now,
        leased_from_block = v_start_block,
        leased_to_block = v_start_block + p_batch_size - 1
    WHERE key = p_key AND chain_id = p_chain_id;

    RETURN jsonb_build_object(
        'allowed', true,
        'start_block', v_start_block,
        'lease_expiry', v_now + v_lease_duration
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Atomic Ingestion RPC (Updated with Crash Safety & Lease Enforcement)
CREATE OR REPLACE FUNCTION ingest_contributor_events(
    p_chain_id INT,
    p_key VARCHAR,
    p_new_cursor BIGINT, -- Kept for API signature compat, but ignored for empty batches now
    p_events JSONB
) RETURNS VOID AS $$
DECLARE
    event_record JSONB;
    v_max_event_block BIGINT;
    v_final_cursor BIGINT;
    v_state RECORD;
BEGIN
    -- 0. Get State & Validate Lease
    SELECT * INTO v_state FROM indexer_state 
    WHERE key = p_key AND chain_id = p_chain_id FOR UPDATE;

    IF v_state IS NULL THEN 
        RAISE EXCEPTION 'Indexer state missing'; 
    END IF;

    IF v_state.leased_to_block IS NULL THEN
        RAISE EXCEPTION 'No active lease found';
    END IF;

    -- 1. Ingest Events
    FOR event_record IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        -- [SAFETY] Strictly Enforce Lease Range
        IF (event_record->>'block_number')::BIGINT > v_state.leased_to_block THEN
            RAISE EXCEPTION 'Security: Event block % exceeds leased range %', 
                (event_record->>'block_number'), v_state.leased_to_block;
        END IF;

        INSERT INTO contributor_events (
            chain_id, tx_hash, log_index, block_number, block_timestamp,
            donor_address, amount_wei, is_anonymous, message
        ) VALUES (
            p_chain_id,
            (event_record->>'tx_hash')::VARCHAR,
            (event_record->>'log_index')::INT,
            (event_record->>'block_number')::BIGINT,
            (event_record->>'block_timestamp')::TIMESTAMP,
            (event_record->>'donor_address')::VARCHAR,
            (event_record->>'amount_wei')::NUMERIC,
            COALESCE((event_record->>'is_anonymous')::BOOLEAN, FALSE),
             event_record->>'message'
        )
        ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING;
    END LOOP;

    -- 2. Calculate Strict Cursor
    -- If events exist: Cursor = MAX(Block) + 1.
    -- If no events: Cursor = leased_to_block + 1 (Trust DB, not Worker).
    SELECT MAX((x->>'block_number')::BIGINT) INTO v_max_event_block
    FROM jsonb_array_elements(p_events) x;

    IF v_max_event_block IS NOT NULL THEN
        v_final_cursor := v_max_event_block + 1;
    ELSE
        v_final_cursor := v_state.leased_to_block + 1;
    END IF;

    -- 3. Update State & Release Lock
    UPDATE indexer_state
    SET last_synced_block = GREATEST(last_synced_block, v_final_cursor),
        last_success_at = NOW(),
        locked_until = NULL, -- Unlock
        owner_id = NULL,
        leased_from_block = NULL, -- Clear lease context
        leased_to_block = NULL,
        updated_at = NOW()
    WHERE key = p_key AND chain_id = p_chain_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [SECURITY] Vital: Prevent public/anon users from calling this RPC
REVOKE EXECUTE ON FUNCTION ingest_contributor_events(INT, VARCHAR, BIGINT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ingest_contributor_events(INT, VARCHAR, BIGINT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION ingest_contributor_events(INT, VARCHAR, BIGINT, JSONB) FROM authenticated;

REVOKE EXECUTE ON FUNCTION claim_indexer_scan(INT, VARCHAR, VARCHAR, BOOLEAN, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_indexer_scan(INT, VARCHAR, VARCHAR, BOOLEAN, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_indexer_scan(INT, VARCHAR, VARCHAR, BOOLEAN, INT) FROM authenticated;

-- -----------------------------------------------------------------------------
-- OBSERVABILITY VIEW
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW indexer_health AS
SELECT
  key,
  chain_id,
  last_synced_block,
  last_success_at,
  locked_until,
  owner_id,
  leased_from_block AS current_lease_start,
  leased_to_block AS current_lease_end,
  NOW() - last_success_at AS lag,
  CASE 
    WHEN locked_until > NOW() THEN 'LOCKED / RUNNING'
    WHEN NOW() - last_success_at > interval '6 hours' THEN 'DELAYED'
    ELSE 'HEALTHY'
  END AS status
FROM indexer_state;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS NOT ENABLED ON PLANS TABLE AS IT IS REMOVED
-- -----------------------------------------------------------------------------

-- Public Read Policies
DROP POLICY IF EXISTS "Public can view chains" ON chains;
CREATE POLICY "Public can view chains" ON chains FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view ads" ON ad_profiles;
CREATE POLICY "Public can view ads" ON ad_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view contributors" ON contributors;
CREATE POLICY "Public can view contributors" ON contributors FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- 8. PENDING CONTRIBUTIONS (Push-Based Ingestion)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_contributions (
    tx_hash VARCHAR(66) PRIMARY KEY,
    chain_id INT NOT NULL DEFAULT 8453,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'failed')),
    retries INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for retry worker
CREATE INDEX IF NOT EXISTS idx_pending_status_created ON pending_contributions(status, created_at);

-- Trigger to update timestamp
DROP TRIGGER IF EXISTS pending_contributions_updated_at ON pending_contributions;
CREATE TRIGGER pending_contributions_updated_at BEFORE UPDATE ON pending_contributions FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Enable RLS
ALTER TABLE pending_contributions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 10. BILL GENERATION SOFT QUEUE (Free-Tier Safe)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bill_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash TEXT NOT NULL,
    chain_id INT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    bill_id TEXT, -- Populated upon completion
    error TEXT,
    queue_position INT DEFAULT 0, -- Deprecated, dynamic calculation used
    metadata JSONB DEFAULT '{}',  -- [NEW] Stores connectedWallet, etc.
    heartbeat_at TIMESTAMPTZ,     -- [NEW] For active crash detection
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one active job per transaction
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tx_chain ON bill_jobs(tx_hash, chain_id);

-- Efficient polling & crash recovery
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON bill_jobs(status, created_at);

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS bill_jobs_updated_at ON bill_jobs;
CREATE TRIGGER bill_jobs_updated_at BEFORE UPDATE ON bill_jobs FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- RLS
ALTER TABLE bill_jobs ENABLE ROW LEVEL SECURITY;

-- Public Policies
DROP POLICY IF EXISTS "Public can view jobs" ON bill_jobs;
CREATE POLICY "Public can view jobs" ON bill_jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert jobs" ON bill_jobs;
CREATE POLICY "Public can insert jobs" ON bill_jobs FOR INSERT WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- ATOMIC CLAIM RPC (CRITICAL FOR CONCURRENCY)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_next_bill_job()
RETURNS TABLE(id uuid, tx_hash text, chain_id int, metadata jsonb) AS $$
BEGIN
  RETURN QUERY
  UPDATE bill_jobs
  SET status = 'processing',
      updated_at = now(),
      heartbeat_at = now()
  WHERE bill_jobs.id = (
    SELECT bill_jobs.id FROM bill_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING bill_jobs.id, bill_jobs.tx_hash, bill_jobs.chain_id, bill_jobs.metadata;
END;
$$ LANGUAGE plpgsql;
