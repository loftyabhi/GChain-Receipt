import { ethers } from 'ethers';
import { supabase } from '../lib/supabase';

// --- Configuration ---
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS || "0xYourVaultAddress"; // TODO: Ensure ENV is passed to API
// Base Mainnet Deployment Block (or Sepolia) - defaulting to 0 or env
const START_BLOCK = process.env.INDEXER_START_BLOCK ? parseInt(process.env.INDEXER_START_BLOCK) : 19548324;
const CHUNK_SIZE = 10;
const POLLING_INTERVAL_MS = 10000; // 10s
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID) : 84532; // Default Base Sepolia

const SUPPORT_VAULT_ABI = [
    "event Contributed(address indexed contributor, address indexed token, uint256 amount, bool isAnonymous, uint256 timestamp)"
];

export class IndexerService {
    private provider: ethers.JsonRpcProvider;
    private contract: ethers.Contract | null = null;
    private isRunning = false;

    constructor() {
        const rpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    public async start() {
        if (this.isRunning) return;

        // [SAFETY] Validate Address before starting
        if (!VAULT_ADDRESS || !ethers.isAddress(VAULT_ADDRESS)) {
            console.warn(`[Indexer] SKIPPING: Invalid or missing VAULT_ADDRESS (${VAULT_ADDRESS}). Check env vars.`);
            return;
        }

        this.contract = new ethers.Contract(VAULT_ADDRESS, SUPPORT_VAULT_ABI, this.provider);
        this.isRunning = true;
        console.log(`[Indexer] Starting Support Vault Indexer for Chain ${CHAIN_ID}...`);
        this.loop();
    }

    private async loop() {
        while (this.isRunning) {
            try {
                await this.syncStep();
            } catch (error) {
                console.error('[Indexer] Sync Error:', error);
                await new Promise(r => setTimeout(r, 5000)); // Backoff
            }
        }
    }

    private async syncStep() {
        // 1. Get Cursor (Atomic Read)
        const { data: state, error } = await supabase
            .from('indexer_state')
            .select('last_synced_block')
            .eq('key', 'contributors_sync')
            .eq('chain_id', CHAIN_ID)
            .single();

        let currentBlock = START_BLOCK;
        if (state) {
            currentBlock = parseInt(state.last_synced_block);
        } else {
            // Initialize if checking for the first time
            // Or assume Deployment Block if not present
            console.log(`[Indexer] No cursor found. Starting from ${START_BLOCK}`);
        }

        const latestBlock = await this.provider.getBlockNumber();

        if (currentBlock >= latestBlock) {
            // Caught up
            await new Promise(r => setTimeout(r, POLLING_INTERVAL_MS));
            return;
        }

        // [CRITICAL] Clamp range
        let toBlock = currentBlock + CHUNK_SIZE;
        if (toBlock > latestBlock) toBlock = latestBlock;

        console.log(`[Indexer] Syncing ${currentBlock} -> ${toBlock} (${Math.round((currentBlock / latestBlock) * 100)}%)`);

        // 2. Fetch Logs
        if (!this.contract) return; // Safety
        const filter = this.contract.filters.Contributed();
        const events = await this.contract.queryFilter(filter, currentBlock, toBlock);

        // 3. Prepare Payload
        const eventPayload = events.map(evt => {
            if (evt instanceof ethers.EventLog) {
                return {
                    tx_hash: evt.transactionHash,
                    log_index: evt.index,
                    block_number: evt.blockNumber,
                    block_timestamp: new Date().toISOString(), // Approximation if block fetching is expensive? No, strictly we should get block time.
                    // But efficiently, user allows 'block_timestamp'.
                    // Optimization: We can just use NOW() or fetch block. fetching block adds RPC calls.
                    // Design says 'block_timestamp'. Implementation "last_contribution_at = NEW.block_timestamp".
                    // Let's fetch block for accuracy? Or just simple timestamp?
                    // To save RPCs, maybe batch fetch blocks?
                    // For now, let's fetch block. It's safer.
                    // WAIT: queryFilter returns EventLog. getting block is extra.
                    // If chunk is 10, that's max 10 blocks.
                    // We can optimise by fetching blocks in parallel or just accepting slight skew?
                    // Let's use `evt.getBlock()` which ethers might cache or fetch.
                    // Actually, let's try to get timestamp.
                    donor_address: evt.args[0],
                    // token: evt.args[1], // Not stored in schema? Amount is wei. Token presumed ETH/Native? 
                    // Schema output: numeric amount.
                    amount_wei: evt.args[2].toString(),
                    message: "" // Not in event?
                };
            }
            return null;
        }).filter(e => e !== null);

        // Fetch Timestamps (Optimized)
        if (eventPayload.length > 0) {
            const blockNumbers = [...new Set(eventPayload.map(e => e!.block_number))];
            const paramArr = blockNumbers.map(b => this.provider.getBlock(b));
            const blocks = await Promise.all(paramArr);
            const blockMap = new Map();
            blocks.forEach(b => { if (b) blockMap.set(b.number, new Date(b.timestamp * 1000).toISOString()) });

            eventPayload.forEach(e => {
                if (e) e.block_timestamp = blockMap.get(e.block_number) || new Date().toISOString();
            });
        }

        // 4. Atomic Ingest RPC
        const { error: rpcError } = await supabase.rpc('ingest_contributor_events', {
            p_chain_id: CHAIN_ID,
            p_key: 'contributors_sync',
            p_new_cursor: toBlock + 1,
            p_events: eventPayload
        });

        if (rpcError) {
            console.error("[Indexer] RPC Failed:", rpcError);
            throw rpcError; // Retry loop
        }

        // Success - loop continues
    }
}
