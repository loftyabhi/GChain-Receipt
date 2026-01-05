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
        // [RPC CONFIG] Simple, clean initialization (Enterprise Fix)
        // Disable staticNetwork to allow Ethers to auto-detect and lock the correctly chain.
        // If BASE_RPC_URL is provided, use it; otherwise default to Base Mainnet.
        const url = process.env.BASE_RPC_URL || "https://mainnet.base.org";
        this.provider = new ethers.JsonRpcProvider(url);

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

        // 2. Loop until caught up or time limit reached (e.g. 50s for serverless)
        const TIME_LIMIT_MS = 50 * 1000;
        const startTime = Date.now();
        let loopCount = 0;

        // Lease is for the *run*, but we update cursor incrementally.
        // We need to be careful with the "Throttle" check. 
        // If we acquired the lock, we own it.

        // Initial fetched block (already have it from lease)
        let currentBlockVal = Number(startBlock);

        // Fetch Latest Block once
        let latestBlock: number;
        try {
            latestBlock = await this.provider.getBlockNumber();
        } catch (err) {
            console.error('[Indexer] network failure: getBlockNumber', err);
            return;
        }

        console.log(`[Indexer] Starting sync. Cursor: ${currentBlockVal}, Target: ${latestBlock}, Batch: ${BATCH_SIZE}`);

        while (currentBlockVal < latestBlock) {
            // Check Timeout
            if (Date.now() - startTime > TIME_LIMIT_MS) {
                console.log(`[Indexer] Time limit reached (${loopCount} batches). Yielding.`);
                break;
            }

            let toBlock = currentBlockVal + BATCH_SIZE - 1;
            if (toBlock > latestBlock) toBlock = latestBlock;

            // 3. Fetch Logs
            try {
                const filter = this.contract.filters.Contributed();
                const events = await this.contract.queryFilter(filter, currentBlockVal, toBlock);

                if (events.length > 0) {
                    console.log(`[Indexer] Found ${events.length} events in range ${currentBlockVal}-${toBlock}`);
                }

                // 4. Process (Fetch Timestamps)
                const eventPayload = await this.processEvents(events);

                // 5. Commit & Unlock (Incremental)
                const newCursor = toBlock + 1;

                // We update the DB state *every batch* to save progress.
                // We keep the owner_id so we don't lose the lock (if we wanted to keep it).
                // But `ingest_contributor_events` currently clears the lock.
                // We should probably modify `ingest_contributor_events` or just accept that we re-acquire?
                // Actually, `ingest_contributor_events` clears `locked_until`.
                // If we want to loop, we should probably conceptually "extend" the lease or just quickly re-grab?
                // Re-grabbing might hit the throttle if we finished successfully.

                // Hack for now: The previous implementation unlocked at the end. 
                // Since `ingest_contributor_events` unlocks, we will lose the lock after the first batch.
                // This defeats the point of the loop if we can't write.

                // Let's use a modified ingest that DOES NOT unlock if we plan to continue?
                // Or simply: Call `claim_indexer_scan` again? 
                // But `claim_indexer_scan` will throttle us because `last_success_at` was just updated!

                // FIX: We need to update the cursor WITHOUT setting `last_success_at` or clearing lock until the VERY END.
                // However, `ingest_contributor_events` is a "do all" RPC.

                // STRATEGY CHANGE: 
                // We will Aggregate ALL events in memory? No, memory risk.
                // We will use standard update but pass a flag? 
                // Given constraints, I will rely on the `sync` function changing to only call `ingest` at the end? 
                // No, if it crashes after 40 batches we lose progress.

                // Better Strategy:
                // Commit batches, but bypass throttle on subsequent loop iterations?
                // We can't simply bypass throttle without `force=true`.
                // But we are inside the service.

                // Let's just USE `force=true` for internal loop iterations specifically.

                const { error: ingestError } = await supabase.rpc('ingest_contributor_events', {
                    p_chain_id: CHAIN_ID,
                    p_key: 'contributors_sync',
                    p_new_cursor: newCursor,
                    p_events: eventPayload
                });

                if (ingestError) throw ingestError;

                // Move forward
                currentBlockVal = newCursor;
                loopCount++;

                // If we want to continue, we need to implicitly "claim" again for the next batch.
                // But `ingest` unlocked it.
                // So next iteration needs to re-claim.
                // We set `force=true` for the subsequent re-claims to bypass our own "just success" throttle.

                // Small sleep to be nice to RPC
                await new Promise(r => setTimeout(r, 200));

                // Re-prepare for next loop:
                if (currentBlockVal < latestBlock) {
                    // Re-claim immediately to continue
                    const { data: nextLease } = await supabase.rpc('claim_indexer_scan', {
                        p_chain_id: CHAIN_ID,
                        p_key: 'contributors_sync',
                        p_owner_id: this.ownerId,
                        p_force: true, // Internal loop forces continuation
                        p_batch_size: BATCH_SIZE
                    });
                    if (!nextLease || !nextLease.allowed) {
                        console.warn("[Indexer] Lost lock during loop. Stopping.");
                        break;
                    }
                }

            } catch (err) {
                console.error(`[Indexer] FAILED range ${currentBlockVal}->${toBlock}:`, err);
                // If fail, we break loop and wait for next cron
                break;
            }
        }

        console.log(`[Indexer] Batch run finished. Processed ${loopCount} batches.`);
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
