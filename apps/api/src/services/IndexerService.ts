import { ethers } from 'ethers';
import { supabase } from '../lib/supabase';

// --- Configuration ---
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS || "0x8a9496cdffd16250353ea19b1ff8ce4de4c294cf";
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID) : 8453; // Default Base Mainnet
const BATCH_SIZE = 10; // Strict limit for free tier (inclusive range)
// POLLING is handled by Cron or Trigger, not internal loop.

const SUPPORT_VAULT_ABI = [
    "event Contributed(address indexed contributor, address indexed token, uint256 amount, bool isAnonymous, uint256 timestamp)"
];

interface SyncOptions {
    force?: boolean; // If true, ignore lock (careful!) - mostly for dev or stuck locks
}

export class IndexerService {
    private provider: ethers.AbstractProvider; // Changed to support Fallback
    private contract: ethers.Contract | null = null;
    private ownerId: string;

    constructor() {
        // [RPC CONFIG] Priority: 1. Mainnet Base (hardcoded) 2. ENV Fallback
        // usage: "first check base.org then try BASE_RPC_URL"
        const providers: (ethers.JsonRpcProvider | any)[] = [];

        // 1. Primary: Base Mainnet
        providers.push({
            provider: new ethers.JsonRpcProvider("https://mainnet.base.org"),
            priority: 1,
            weight: 2
        });

        // 2. Secondary: ENV (if provided)
        if (process.env.BASE_RPC_URL && process.env.BASE_RPC_URL !== "https://mainnet.base.org") {
            providers.push({
                provider: new ethers.JsonRpcProvider(process.env.BASE_RPC_URL),
                priority: 2,
                weight: 1
            });
        }

        // Use FallbackProvider for redundancy
        // If only one exists, it behaves like a normal provider.
        if (providers.length === 1) {
            this.provider = (providers[0] as any).provider;
        } else {
            this.provider = new ethers.FallbackProvider(providers, 1);
        }

        // Unique ID for this instance (stateless execution)
        this.ownerId = `worker-${Math.random().toString(36).substring(7)}`;
    }

    /**
     * Stateless Sync Function
     * Designed to be called by Cron (6hr) or User Trigger (Immediate)
     * 
     * NOTE: This design currently supports Single-Worker Mutual Exclusion.
     * Parallel indexing requires future implementation of block-range partitioning.
     */
    public async sync(options: SyncOptions = {}) {
        const { force = false } = options;
        // console.log(`[Indexer] Req: ${this.ownerId}, Force: ${force}`); // Verbose off

        if (!VAULT_ADDRESS || !ethers.isAddress(VAULT_ADDRESS)) {
            console.error(`[Indexer] ABORT: Invalid VAULT_ADDRESS (${VAULT_ADDRESS})`);
            return;
        }

        if (!this.contract) {
            this.contract = new ethers.Contract(VAULT_ADDRESS, SUPPORT_VAULT_ABI, this.provider);
        }

        // 1. Claim Lease (Atomic DB Locking + Throttling)
        const { data: lease, error: leaseError } = await supabase.rpc('claim_indexer_scan', {
            p_chain_id: CHAIN_ID,
            p_key: 'contributors_sync',
            p_owner_id: this.ownerId,
            p_force: force,
            p_batch_size: BATCH_SIZE
        });

        if (leaseError) throw leaseError;

        if (!lease || !lease.allowed) {
            console.warn(`[Indexer] Skipped: ${lease?.reason || 'Denied'} (Next: ${lease?.next_run_at || 'N/A'}, LockedUntil: ${lease?.locked_until || 'N/A'})`);
            return;
        }

        const startBlock = BigInt(lease.start_block);

        // 2. Determine Range
        let latestBlock: number;
        try {
            latestBlock = await this.provider.getBlockNumber();
        } catch (err) {
            console.error('[Indexer] network failure: getBlockNumber');
            return; // Lock expires naturally
        }

        const currentBlockVal = Number(startBlock);

        if (currentBlockVal >= latestBlock) {
            console.log(`[Indexer] Idle. Cursor: ${currentBlockVal} (Latest: ${latestBlock})`);
            await this.releaseLock(currentBlockVal);
            return;
        }

        let toBlock = currentBlockVal + BATCH_SIZE - 1;
        if (toBlock > latestBlock) toBlock = latestBlock;

        // OBSERVABILITY: Log Range
        console.log(`[Indexer] LEASED: ${currentBlockVal} -> ${toBlock} (${toBlock - currentBlockVal + 1} blocks) | Owner: ${this.ownerId}`);

        // 3. Fetch Logs
        try {
            const filter = this.contract.filters.Contributed();
            const events = await this.contract.queryFilter(filter, currentBlockVal, toBlock);

            // OBSERVABILITY: Log Events Found
            if (events.length > 0) {
                console.log(`[Indexer] FOUND ${events.length} events in range.`);
            }

            // 4. Process (Fetch Timestamps)
            const eventPayload = await this.processEvents(events);

            // 5. Commit & Unlock
            // Rule: cursor = max(scanned_block) + 1
            // We scanned up to `toBlock` (inclusive).
            // Even if 0 events, we successfully scanned this range.
            const newCursor = toBlock + 1;

            const { error: ingestError } = await supabase.rpc('ingest_contributor_events', {
                p_chain_id: CHAIN_ID,
                p_key: 'contributors_sync',
                p_new_cursor: newCursor,
                p_events: eventPayload
            });

            if (ingestError) throw ingestError;

            // OBSERVABILITY: Log Success
            console.log(`[Indexer] SUCCESS: Cursor advanced ${currentBlockVal} -> ${newCursor}. Events Ingested: ${eventPayload.length}`);

        } catch (err) {
            console.error(`[Indexer] FAILED range ${currentBlockVal}->${toBlock}:`, err);
            // Lock expires naturally, allowing retry.
        }
    }

    private async releaseLock(currentCursor: number) {
        await supabase.rpc('ingest_contributor_events', {
            p_chain_id: CHAIN_ID,
            p_key: 'contributors_sync',
            p_new_cursor: currentCursor,
            p_events: []
        });
    }

    private async processEvents(events: Array<ethers.EventLog | ethers.Log>): Promise<any[]> {
        const rawPayload = events.map(evt => {
            if (evt instanceof ethers.EventLog) {
                return {
                    tx_hash: evt.transactionHash,
                    log_index: evt.index,
                    block_number: evt.blockNumber,
                    donor_address: evt.args[0],
                    amount_wei: evt.args[2].toString(),
                    is_anonymous: evt.args[3],
                    message: ""
                };
            }
            return null;
        }).filter(e => e !== null);

        if (rawPayload.length === 0) return [];

        const blockNumbers = [...new Set(rawPayload.map(e => e!.block_number))];
        const blockMap = new Map<number, string>();

        await Promise.all(blockNumbers.map(async (bNum) => {
            try {
                const b = await this.provider.getBlock(bNum);
                if (b) blockMap.set(bNum, new Date(b.timestamp * 1000).toISOString());
            } catch (e) {
                console.error(`[Indexer] Failed to fetch timestamp for block ${bNum}`);
            }
        }));

        return rawPayload.map(e => ({
            ...e,
            block_timestamp: blockMap.get(e!.block_number) || new Date().toISOString()
        }));
    }
}
