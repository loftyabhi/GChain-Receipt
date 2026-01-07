// src/services/classifier/rules/transfer/TransferRule.ts
import { ClassificationContext } from '../../core/Context';
import { ClassificationRule, RuleResult } from '../../core/Rule';
import { TransactionType } from '../../core/types';

export class TransferRule implements ClassificationRule {
    public id = 'core_transfer';
    public name = 'Token/Native Transfer';
    public priority = 40; // Low priority (Fallback)

    public matches(ctx: ClassificationContext): boolean {
        // Strict Matches Logic as requested:
        // Return true only if simple enough to be a transfer.

        // 1. Must have flow or value
        const hasValue = BigInt(ctx.tx.value) > BigInt(0);
        const hasLogs = ctx.receipt.logs.length > 0;
        if (!hasValue && !hasLogs) return false;

        // 2. Exclude Obvious Complex Flows (Swap/NFT Sale signals) at Match level?
        // User requirements: "No NFT movement... No swap-like bidirectional flow..."
        // If we filter here, we save processing.
        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];

        if (flow) {
            // Bidirectional Check (Swap-like)
            // (Strict Gate: If netOut AND netIn, it's not a simple transfer)
            const netOutCount = flow.outgoing.filter(a => BigInt(a.amount) > BigInt(0)).length;
            const netInCount = flow.incoming.filter(a => BigInt(a.amount) > BigInt(0)).length;
            if (netOutCount > 0 && netInCount > 0) return false;

            // Multiple Assets Check (Bulk/Complex)
            // If we rely on classify to handle "Exactly one", we can skip here, but user asked for "matches() must return true only if..."
            // Let's implement strict gates in classify() primarily to provide reasons, 
            // but reject bidirectional here to adhere to "No swap-like bidirectional flow".
            // Actually, "Matches" returning false makes the rule invisible. 
            // "Classify" returning null allows logging "Matched but filtered".

            // The user explicitly listed: "If user has netOut AND netIn: return null;" in the section "TransferRule.ts — Strict Fallback Semantics".
            // This was listed under general requirements, likely for classify().
            // However, Section 3 says "TransferRule matches() must return true only if: No swap-like bidirectional flow".
            // So I will enforce it here.
        }

        return true;
    }

    public classify(ctx: ClassificationContext): RuleResult {
        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];

        // --- 0. PRE-FLIGHT CHECK (Strict Fallback) ---
        // If bidirectional, return null (Swap/Lending territory)
        if (flow) {
            const hasOut = flow.outgoing.some(a => BigInt(a.amount) > BigInt(0));
            const hasIn = flow.incoming.some(a => BigInt(a.amount) > BigInt(0));
            if (hasOut && hasIn) return null as any;
        }

        // --- 1. NATIVE TRANSFER CHECK ---
        // tx.value > 0, data == '0x', No internal calls moving assets (implies strict flow check)
        const isNative = ctx.tx.data === '0x' && BigInt(ctx.tx.value) > BigInt(0);

        if (isNative) {
            // "No internal calls moving assets"
            // If logs exist, it might be a contract receiving ETH and doing something.
            // If flow exists (sender -> recipient), check if only 1 movement.
            if (flow) {
                // Should have exactly 1 outgoing (ETH) and 0 incoming.
                // And ideally no other logs (simple transfer).
                // If logs exist, it's strictly "Contract Interaction" fallback unless classified elsewhere.
                const isSimple = flow.outgoing.length === 1 && flow.outgoing[0].type === 'NATIVE' && flow.incoming.length === 0;
                if (isSimple && ctx.receipt.logs.length === 0) {
                    return {
                        type: TransactionType.NATIVE_TRANSFER,
                        confidence: 0.6, // Max confidence cap
                        breakdown: { executionMatch: 1.0, tokenFlowMatch: 1.0, methodMatch: 1.0, eventMatch: 0, addressMatch: 1.0 },
                        reasons: ['Native ETH transfer (0x data, value > 0)']
                    };
                }
            }
        }

        if (!flow) return null as any; // Needed for Token checks

        // --- 2. TOKEN TRANSFER ---
        // "Exactly one ERC20 transfer. User is sender OR receiver. No other asset movements."
        const erc20Out = flow.outgoing.filter(m => m.type === 'ERC20');
        const erc20In = flow.incoming.filter(m => m.type === 'ERC20');
        const allOut = flow.outgoing;
        const allIn = flow.incoming;

        // Outgoing Transfer
        if (allOut.length === 1 && allIn.length === 0 && erc20Out.length === 1) {
            return {
                type: TransactionType.TOKEN_TRANSFER,
                confidence: 0.6,
                breakdown: { tokenFlowMatch: 1.0, addressMatch: 0, methodMatch: 0, eventMatch: 1, executionMatch: 0 },
                reasons: [`Single ERC20 outgoing movement`]
            };
        }

        // Incoming Transfer (User received)
        if (allIn.length === 1 && allOut.length === 0 && erc20In.length === 1) {
            return {
                type: TransactionType.TOKEN_TRANSFER,
                confidence: 0.6,
                breakdown: { tokenFlowMatch: 1.0, addressMatch: 0, methodMatch: 0, eventMatch: 1, executionMatch: 0 },
                reasons: [`Single ERC20 incoming movement`]
            };
        }

        // --- 3. NFT TRANSFER ---
        // "Exactly one NFT moved. No correlated payment. No bridge/lending semantics (Assumed handled by Priority)"
        const nftOut = flow.outgoing.filter(m => ['ERC721', 'ERC1155'].includes(m.type));
        const nftIn = flow.incoming.filter(m => ['ERC721', 'ERC1155'].includes(m.type));

        // Outgoing NFT
        if (nftOut.length === 1 && allOut.length === 1 && allIn.length === 0) {
            return {
                type: TransactionType.NFT_TRANSFER,
                confidence: 0.6,
                breakdown: { tokenFlowMatch: 1.0, addressMatch: 0, methodMatch: 0, eventMatch: 1, executionMatch: 0 },
                reasons: [`Single NFT outgoing movement`]
            };
        }

        // Incoming NFT
        if (nftIn.length === 1 && allIn.length === 1 && allOut.length === 0) {
            return {
                type: TransactionType.NFT_TRANSFER,
                confidence: 0.6,
                breakdown: { tokenFlowMatch: 1.0, addressMatch: 0, methodMatch: 0, eventMatch: 1, executionMatch: 0 },
                reasons: [`Single NFT incoming movement`]
            };
        }

        // If multiple assets or mixed directions (already caught), return null.
        return null as any;
    }
}
