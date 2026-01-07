// src/services/classifier/rules/dex/SwapRule.ts
import { ClassificationRule, RuleResult } from '../../core/Rule';
import { ClassificationContext } from '../../core/Context';
import { TransactionType } from '../../core/types';

const SWAP_EVENTS = [
    '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822', // Uniswap V2: Swap
    '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67', // Uniswap V3: Swap
    '0xc4d252f84c8a7b193efff4263a3e6b7d2f31f9d45d3153e70d4d8c6d1e44f8e7', // Balancer / Curve
    '0x087e682a9db3d440875c75567c29378626c9a9415c4856b3e71783f98285559d', // 1inch Swapped
];

// Minimal amount to consider meaningful (to ignore dust)
const MIN_SWAP_VALUE = BigInt(1000); // Very loose threshold, handles most 18-dec tokens (> 0.000...1)

export class SwapRule implements ClassificationRule {
    id = 'dex_swap';
    name = 'DEX Swap';
    priority = 90; // High priority for Protocol Semantic

    matches(ctx: ClassificationContext): boolean {
        // Fix 3: Event Presence Is a Boost, Not a Gate
        // Match if:
        // 1. Known Swap Events exist
        // 2. OR Bidirectional Token Flow exists (Aggregator / Unknown DEX support)

        if (ctx.receipt.logs.some(l => SWAP_EVENTS.includes(l.topics[0]))) return true;

        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];
        if (flow) {
            // Must have Incoming AND Outgoing for a potential swap
            if (flow.incoming.length > 0 && flow.outgoing.length > 0) return true;
        }

        return false;
    }

    classify(ctx: ClassificationContext): RuleResult {
        const swapLogs = ctx.receipt.logs.filter(l => SWAP_EVENTS.includes(l.topics[0]));
        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];
        const reasons: string[] = [];

        // 1. Event Match (Boost)
        let eventMatch = 0.0;
        let confidence = 0.0; // Start at 0, require flow evidence

        if (swapLogs.length > 0) {
            eventMatch = 1.0;
            confidence += 0.25; // Base boost for detecting a Swap event
            reasons.push(`Matched ${swapLogs.length} Swap events`);
        }

        // 2. Token Flow (Mandatory Check)
        // Fix 1: Net User Delta Is Mandatory
        if (!flow) return null as any;

        const netOut = flow.outgoing.filter(a => BigInt(a.amount) > MIN_SWAP_VALUE);
        const netIn = flow.incoming.filter(a => BigInt(a.amount) > MIN_SWAP_VALUE);

        if (netOut.length === 0 || netIn.length === 0) {
            // Cannot be a user-initiated swap if user didn't give and receive
            return null as any;
        }

        // We have bidirectional meaningful flow
        confidence += 0.4;
        reasons.push('Bidirectional flow confirmed (Assets Sent & Received)');

        // Fix 2: Asset Difference Enforcement
        // If Out == In, it's likely a Wrap/Unwrap or Rebase, not a Swap
        const outAsset = netOut[0].asset;
        const inAsset = netIn[0].asset;
        if (netOut.length === 1 && netIn.length === 1 && outAsset === inAsset) {
            confidence -= 0.4; // Heavy penalty for same-asset "swap"
            reasons.push('Penalty: Input and Output assets are identical (Likely Wrap/Unwrap)');
        }

        // Fix 5: Multi-Hop Swap Consolidation
        // If User sents A, B -> Gets C? Or Sends A -> Gets B, C?
        // Usually Swap is 1 In, 1 Out (dominant). 
        if (netIn.length === 1 && netOut.length >= 1) {
            confidence += 0.15;
            reasons.push('Clean Swap Pattern (Single dominant output)');
        }

        // Fix 6: Penalize Internal-Only Swaps (Redundant with Net Delta check, but logic persists)
        // If we only detected swap because of events, but flow is weird?
        // Already handled by the "Net Delta Mandatory" check.

        // 3. Address Match
        let addressMatch = 0.5;
        if (swapLogs.some(l => l.address.toLowerCase() === ctx.effectiveTo)) {
            addressMatch = 0.8;
            confidence += 0.1;
            reasons.push('Direct interaction with Swap Pair');
        }

        confidence = Math.min(1.0, Math.max(0.0, confidence));

        return {
            type: TransactionType.SWAP,
            confidence,
            breakdown: {
                eventMatch,
                methodMatch: 0,
                addressMatch,
                tokenFlowMatch: 1.0,
                executionMatch: 1.0
            },
            protocol: 'DEX',
            reasons
        };
    }
}
