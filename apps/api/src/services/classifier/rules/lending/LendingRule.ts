// src/services/classifier/rules/lending/LendingRule.ts
import { ClassificationRule, RuleResult } from '../../core/Rule';
import { ClassificationContext } from '../../core/Context';
import { TransactionType } from '../../core/types';

const LENDING_EVENTS = {
    // Aave
    DEPOSIT: '0xde6857219544bb5b7746f48ed30be6386fefc61b2f864cacf559893bf50fd951', // Supply
    WITHDRAW: '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7',
    BORROW: '0xc6a898309e823ee50bac64e45ca8adba6690e99e7841c45d754e2a38e9019d9b',
    REPAY: '0x4cdde6e09bb755c9a5589ebaec640bbfedff1362d4b255ebf8339782b9942faa',
    LIQUIDATION: '0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286',

    // Compound
    MINT: '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
    REDEEM: '0xe5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929',
    BORROW_COMP: '0x13ed6866d4e1ee6da46f16c3d936f33f85f6b6189124208d58d43381285286a8',
    REPAY_BORROW: '0x1a2a22cb034d26d1854bdc6666a5b91fe25efbbb5dcad3b0355478d6f5c362a1',
};

export class LendingRule implements ClassificationRule {
    id = 'lending_generic';
    name = 'Lending Protocol';
    priority = 90; // Just below Bridge (which matches high), equal to Swap (which has strict flow)

    matches(ctx: ClassificationContext): boolean {
        // Match if:
        // 1. Any Lending Event found matches
        // 2. OR User Flow suggests lending (generic check)
        const hasLendingEvent = ctx.receipt.logs.some(l => Object.values(LENDING_EVENTS).includes(l.topics[0]));
        if (hasLendingEvent) return true;

        // Optimistic matching for flow (defer strictness to classify)
        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];
        if (flow && (flow.incoming.length > 0 || flow.outgoing.length > 0)) {
            // Very broad match, relies on scoring to filter
            return true;
        }

        return false;
    }

    classify(ctx: ClassificationContext): RuleResult {
        // --- 1. SIGNAL GATHERING (Recreated from Lending.ts for Sync usage) ---
        const logs = ctx.receipt.logs;
        const to = ctx.effectiveTo?.toLowerCase();

        let confidenceBoost = 0.0;
        let protocol = 'Lending Protocol';

        // A. Known Protocol (+0.35)
        // Hardcoded list for Sync usage (would ideally share config)
        const KNOWN_POOLS = ['0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2', '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b'];
        if (to && KNOWN_POOLS.includes(to)) {
            confidenceBoost += 0.35;
            protocol = 'Known Lending Pool';
        }

        // B. Event Matches (+0.25)
        const lendingEventsFound = logs.filter(l => Object.values(LENDING_EVENTS).includes(l.topics[0]));
        if (lendingEventsFound.length > 0) {
            confidenceBoost += 0.25;

            // Refine Protocol Name
            if (lendingEventsFound.some(l => [LENDING_EVENTS.DEPOSIT, LENDING_EVENTS.WITHDRAW].includes(l.topics[0]))) {
                protocol = 'Aave Compatible';
            } else if (lendingEventsFound.some(l => [LENDING_EVENTS.MINT, LENDING_EVENTS.REDEEM].includes(l.topics[0]))) {
                protocol = 'Compound Compatible';
            }
        }

        // C. Internal Interaction (+0.2)
        const internalInteraction = logs.some(l => KNOWN_POOLS.includes(l.address.toLowerCase()));
        if (internalInteraction) confidenceBoost += 0.2;

        // Cap Boost
        confidenceBoost = Math.min(confidenceBoost, 0.45);


        // --- 2. MANDATORY FLOW SEMANTICS (Hard Gates) ---
        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];
        if (!flow) return null as any;

        const netOut = flow.outgoing.filter(a => BigInt(a.amount) > BigInt(1000));
        const netIn = flow.incoming.filter(a => BigInt(a.amount) > BigInt(1000));

        // Gate: No net delta -> 0 confidence
        if (netOut.length === 0 && netIn.length === 0) {
            confidenceBoost = 0;
        }

        // --- 3. ACTION INFERENCE & FLOW MATCHING ---
        let inferredType: TransactionType | undefined;
        let actionReason = '';
        let flowConfidence = 0.0; // Base confidence from flow

        const hasOut = netOut.length > 0;
        const hasIn = netIn.length > 0;

        // DEPOSIT: Out (Underlying) -> In (Receipt)? OR Just Out (Native)?
        // WITHDRAW: Out (Receipt) -> In (Underlying)?
        // BORROW: In (Underlying)?
        // REPAY: Out (Underlying)?

        if (hasOut && hasIn) {
            // Bidirectional Flow
            // Could be Deposit (Supply -> Receive aToken) or Withdraw (Burn aToken -> Receive Underlying)
            // Distinguish from Swap?
            // Lending usually involves aToken/cToken.
            // We can check if `in` or `out` is a known receipt token? Hard without list.
            // We rely on EVENT + FLOW combination.

            if (lendingEventsFound.some(l => [LENDING_EVENTS.DEPOSIT, LENDING_EVENTS.MINT].includes(l.topics[0]))) {
                inferredType = TransactionType.LENDING_DEPOSIT;
                flowConfidence = 0.4;
                actionReason = 'Bidirectional with Deposit Event';
            } else if (lendingEventsFound.some(l => [LENDING_EVENTS.WITHDRAW, LENDING_EVENTS.REDEEM].includes(l.topics[0]))) {
                inferredType = TransactionType.LENDING_WITHDRAW;
                flowConfidence = 0.4;
                actionReason = 'Bidirectional with Withdraw Event';
            } else {
                // Bidirectional without clear lending event -> Likely Swap
                // Penalty
                confidenceBoost -= 0.3;
            }
        } else if (hasOut && !hasIn) {
            // Unidirectional Out
            // Could be Repay or Deposit (if Receipt token not tracked/minted to user directly)
            if (lendingEventsFound.some(l => [LENDING_EVENTS.REPAY, LENDING_EVENTS.REPAY_BORROW].includes(l.topics[0]))) {
                inferredType = TransactionType.LENDING_REPAY;
                flowConfidence = 0.4;
            } else if (lendingEventsFound.some(l => [LENDING_EVENTS.DEPOSIT, LENDING_EVENTS.MINT].includes(l.topics[0]))) {
                inferredType = TransactionType.LENDING_DEPOSIT;
                flowConfidence = 0.4;
            }
        } else if (hasIn && !hasOut) {
            // Unidirectional In
            // Could be Borrow
            if (lendingEventsFound.some(l => [LENDING_EVENTS.BORROW, LENDING_EVENTS.BORROW_COMP].includes(l.topics[0]))) {
                inferredType = TransactionType.LENDING_BORROW;
                flowConfidence = 0.4;
            }
        }

        // --- 4. PENALTIES ---
        // Pure ERC20 transfer without lending events
        if (netOut.length > 0 && !lendingEventsFound.length && confidenceBoost <= 0.4) {
            confidenceBoost -= 0.25;
        }

        // Swap-like flow (Bidirectional) without receipt tokens logic (generic check)
        if (hasIn && hasOut && !inferredType) {
            confidenceBoost = 0; // Prevent overtaking swap
        }

        // --- 5. FINAL GATE ---
        // Need >= 0.7 Total Confidence
        const totalConfidence = confidenceBoost + flowConfidence;

        if (totalConfidence < 0.7 || !inferredType) {
            return null as any;
        }

        return {
            type: inferredType,
            confidence: Math.min(totalConfidence, 1.0),
            breakdown: {
                eventMatch: lendingEventsFound.length > 0 ? 1.0 : 0,
                methodMatch: 0,
                addressMatch: 0,
                tokenFlowMatch: 1.0,
                executionMatch: 1.0
            },
            protocol,
            reasons: [actionReason, `Signal Boost: ${confidenceBoost.toFixed(2)}`, `Flow Base: ${flowConfidence.toFixed(2)}`]
        };
    }
}
