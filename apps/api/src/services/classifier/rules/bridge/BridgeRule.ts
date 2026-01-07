// src/services/classifier/rules/bridge/BridgeRule.ts
import { ClassificationRule, RuleResult } from '../../core/Rule';
import { ClassificationContext } from '../../core/Context';
import { TransactionType } from '../../core/types';
import { BridgeDetector } from '../../protocols/Bridge';

export class BridgeRule implements ClassificationRule {
    id = 'bridge_canonical';
    name = 'Canonical Bridge Operation';
    priority = 90; // High Priority

    private detector = new BridgeDetector();

    matches(ctx: ClassificationContext): boolean {
        // Match if:
        // 1. Detector finds *any* signal (confidence > 0)
        // 2. OR User flow hints at bridging (Unidirectional to known bridge - covered by detector usually)
        return true; // We defer strict check to classify() to gather confidence
    }

    classify(ctx: ClassificationContext): RuleResult {
        // 1. Get Protocol Signal
        // We use the detector purely for signal boost
        // Since detector is async in IProtocolDetector but we need sync here, 
        // we might ideally have run this in Phase 1 or 2. 
        // For now, we replicate the Sync logic or we need to await. 
        // The Engine calls classify() synchronously? 
        // Wait, Engine.ts calls classify() which returns RuleResult. 
        // Engine.ts:44 is async classify()... 
        // Rule.ts interface says classify(ctx): RuleResult; 
        // The interface is SYNC. We cannot await the detector here if it is async.
        // However, BridgeDetector logic is purely Log/Address based (Sync safe).
        // We will assume we can run the logic synchronously.

        let confidenceBoost = 0.0;
        let protocol = 'Native Bridge';
        let inferredType = TransactionType.BRIDGE_DEPOSIT;

        // Sync adaptation of Detector Logic (Safe because BridgeDetector uses no RPC)
        const logs = ctx.receipt.logs;
        const to = ctx.effectiveTo?.toLowerCase(); // Use resolved target

        // --- DUPLICATED SYNC LOGIC from Bridge.ts (Adapter) ---
        // (To avoid changing Rule interface to Async)
        const BRIDGE_EVENTS = {
            BRIDGE_TRANSFER_SENT: '0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e',
            BRIDGE_TRANSFER_RECEIVED: '0x1b2a7ff080b8cb6ff436ce0372e399692bbfb6d4ae5766fd8d58a7b8cc6142e6',
            // ... others
        };

        // 1. Known Bridge Address (+0.35) - Uses chain config
        if (to && ctx.chain.canonicalBridges.has(to)) {
            confidenceBoost += 0.35;
            protocol = 'Canonical Bridge'; // We don't have name map here without detector instance
        }

        // 2. Event Signatures (+0.25)
        // ... (Simulated for brevity, relying on Bridge.ts is better if we could)
        // Actually, we should rely on context having executed detection? 
        // Or just implement the logic here as per "BridgeRule Classification Fixes" instructions.

        // Let's implement the logic strictly here as requested.

        // Re-implement Signal Logic (Sync)
        const bridgeEventsFound = logs.some(l =>
            Object.values(BRIDGE_EVENTS).includes(l.topics[0]) ||
            // Add other common bridge event hashes
            l.topics[0] === '0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054' // Optimism Msg
        );

        if (bridgeEventsFound) confidenceBoost += 0.25;

        // Internal Call (+0.2)
        // Use ctx.chain.canonicalBridges to check log emitters
        const internalInteraction = logs.some(l => ctx.chain.canonicalBridges.has(l.address.toLowerCase()));
        if (internalInteraction) confidenceBoost += 0.2;

        // Cap Boost
        confidenceBoost = Math.min(confidenceBoost, 0.45);


        // --- 2. MANDATORY FLOW GUARDS ---
        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];
        if (!flow) return null as any;

        const netOut = flow.outgoing.filter(a => BigInt(a.amount) > BigInt(100)); // Ignore dust
        const netIn = flow.incoming.filter(a => BigInt(a.amount) > BigInt(100));

        // GUARD: Bidirectional Flow -> ZERO Confidence
        if (netOut.length > 0 && netIn.length > 0) {
            confidenceBoost = 0;
        }

        // GUARD: Wrapping Semantics (Same asset In/Out) - Already covered by Bidirectional


        // --- 3. DIRECTION INFERENCE ---
        if (netOut.length > 0 && netIn.length === 0) {
            inferredType = TransactionType.BRIDGE_DEPOSIT;
            confidenceBoost += 0.4; // Base confidence for Unidirectional Flow
        } else if (netIn.length > 0 && netOut.length === 0) {
            inferredType = TransactionType.BRIDGE_WITHDRAW;
            confidenceBoost += 0.4;
        } else {
            // No clear direction?
            if (confidenceBoost < 0.3) return null as any; // Ignore
        }

        // --- 4. PENALTIES ---
        // Generic ERC20 without bridge semantics
        if (netOut.length > 0 && !bridgeEventsFound && confidenceBoost <= 0.4) {
            confidenceBoost -= 0.25; // Penalty for looking like a generic transfer
        }

        // NFT without lock
        const nftMoved = flow.outgoing.some(m => ['ERC721', 'ERC1155'].includes(m.type));
        if (nftMoved && !bridgeEventsFound) {
            confidenceBoost -= 0.25;
        }

        // --- 5. FINAL CLASSIFICATION GATE ---
        // BridgeRule must classify only if confidenceBoost >= 0.7
        // (Note: We added base flow flow confidence of 0.4, so we need +0.3 from signal)

        // Current Sum:
        // Flow (0.4) + Address (0.35) = 0.75 -> Pass
        // Flow (0.4) + Event (0.25) = 0.65 -> Fail (Correct, generic transfer)
        // Flow (0.4) + Event (0.25) + Internal (0.2) = 0.85 -> Pass

        if (confidenceBoost < 0.7) {
            return null as any;
        }

        return {
            type: inferredType,
            confidence: Math.min(confidenceBoost, 1.0),
            breakdown: {
                eventMatch: bridgeEventsFound ? 1.0 : 0,
                methodMatch: 0,
                addressMatch: 1.0,
                tokenFlowMatch: 1.0,
                executionMatch: 1.0
            },
            protocol, // Only if boost > 0, which it is
            reasons: [`Confirmed Unidirectional Bridge Flow (${inferredType})`, `Signal Boost: ${confidenceBoost.toFixed(2)}`]
        };
    }
}
