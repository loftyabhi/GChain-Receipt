-- 1. Add chain_id to 'contributors' if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributors' AND column_name='chain_id') THEN
        ALTER TABLE contributors ADD COLUMN chain_id INT DEFAULT 84532; -- Default to Base Sepolia
        ALTER TABLE contributors ALTER COLUMN chain_id SET NOT NULL;
        -- Update PK to composite (drop old, add new)
        ALTER TABLE contributors DROP CONSTRAINT contributors_pkey;
        ALTER TABLE contributors ADD PRIMARY KEY (wallet_address, chain_id);
    END IF;
END $$;

-- 2. Add chain_id to 'indexer_state' if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='indexer_state' AND column_name='chain_id') THEN
        ALTER TABLE indexer_state ADD COLUMN chain_id INT DEFAULT 84532;
        ALTER TABLE indexer_state ALTER COLUMN chain_id SET NOT NULL;
        -- Update PK
        ALTER TABLE indexer_state DROP CONSTRAINT indexer_state_pkey;
        ALTER TABLE indexer_state ADD PRIMARY KEY (key, chain_id);
        
        -- Add Check Constraint
        ALTER TABLE indexer_state ADD CONSTRAINT check_last_synced_positive CHECK (last_synced_block >= 0);
    END IF;
END $$;

-- 3. Create 'contributor_events'
CREATE TABLE IF NOT EXISTS contributor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id INT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMP,
    donor_address VARCHAR(42) NOT NULL,
    amount_wei NUMERIC(78, 0) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, tx_hash, log_index)
);
ALTER TABLE contributor_events ENABLE ROW LEVEL SECURITY;

-- 4. Create/Update Trigger Function
CREATE OR REPLACE FUNCTION update_contributors() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contributors (wallet_address, chain_id, total_amount_wei, contribution_count, last_contribution_at, updated_at)
  VALUES (NEW.donor_address, NEW.chain_id, NEW.amount_wei, 1, NEW.block_timestamp, NOW())
  ON CONFLICT (wallet_address, chain_id)
  DO UPDATE SET
    total_amount_wei = contributors.total_amount_wei + NEW.amount_wei,
    contribution_count = contributors.contribution_count + 1,
    last_contribution_at = NEW.block_timestamp,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Bind Trigger
DROP TRIGGER IF EXISTS trg_update_contributors ON contributor_events;
CREATE TRIGGER trg_update_contributors
AFTER INSERT ON contributor_events
FOR EACH ROW EXECUTE FUNCTION update_contributors();

-- 6. Create RPC Function (Atomic Ingestion)
CREATE OR REPLACE FUNCTION ingest_contributor_events(
    p_chain_id INT,
    p_key VARCHAR,
    p_new_cursor BIGINT,
    p_events JSONB
) RETURNS VOID AS $$
DECLARE
    event_record JSONB;
BEGIN
    FOR event_record IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        INSERT INTO contributor_events (
            chain_id, tx_hash, log_index, block_number, block_timestamp,
            donor_address, amount_wei, message
        ) VALUES (
            p_chain_id,
            (event_record->>'tx_hash')::VARCHAR,
            (event_record->>'log_index')::INT,
            (event_record->>'block_number')::BIGINT,
            (event_record->>'block_timestamp')::TIMESTAMP,
            (event_record->>'donor_address')::VARCHAR,
            (event_record->>'amount_wei')::NUMERIC,
             event_record->>'message'
        )
        ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING;
    END LOOP;

    INSERT INTO indexer_state (key, chain_id, last_synced_block, updated_at)
    VALUES (p_key, p_chain_id, p_new_cursor, NOW())
    ON CONFLICT (key, chain_id)
    DO UPDATE SET last_synced_block = p_new_cursor, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
