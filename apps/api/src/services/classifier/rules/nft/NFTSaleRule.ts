// src/services/classifier/rules/nft/NFTSaleRule.ts
import { ClassificationRule, RuleResult } from '../../core/Rule';
import { ClassificationContext } from '../../core/Context';
import { TransactionType } from '../../core/types';

const MARKETPLACE_EVENTS = [
    '0x9d9af8e38d66c62e2c12f0225249fd9d721c54b83f48d9352c97c6cacdcb6f31', // Seaport OrderFulfilled
    '0x61cbb2a3dee0b6064c2e681aadd61677fb4ef319f0b547508d495626f5a62f64', // Blur OrderMatched
    '0xc4109843e0b7d514e4c093114b863f8e7d8d9a458c372cd51bfe526b588006c9', // OpenSea OrderMatched (Legacy)
    '0x68cd251d4d267c6e2034ff0088b99c381c1369187d6b832b096a84aaefeb6546', // LooksRare TakerAsk
    '0x3ee3de4684413690dee6fff1a0a4f934e643255547c92e75306e745f8cdea2d2', // LooksRare TakerBid
];

export class NFTSaleRule implements ClassificationRule {
    id = 'nft_sale';
    name = 'NFT Marketplace Sale';
    priority = 80; // Below Bridge (90) and Lending (90)

    matches(ctx: ClassificationContext): boolean {
        // Match if:
        // 1. Marketplace Events found
        // 2. OR User sent/received NFT (Generic check)

        // Optimistic matching:
        if (ctx.receipt.logs.some(l => MARKETPLACE_EVENTS.includes(l.topics[0]))) return true;

        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];
        if (!flow) return false;

        // Basic NFT movement check (In or Out)
        return flow.incoming.some(m => ['ERC721', 'ERC1155'].includes(m.type)) ||
            flow.outgoing.some(m => ['ERC721', 'ERC1155'].includes(m.type));
    }

    classify(ctx: ClassificationContext): RuleResult {
        const marketLogs = ctx.receipt.logs.filter(l => MARKETPLACE_EVENTS.includes(l.topics[0]));
        const sender = ctx.tx.from.toLowerCase();
        const flow = ctx.flow[sender];
        const reasons: string[] = [];

        // Base Confidence
        let confidence = 0.5;

        // 1. Event Presence (+0.3)
        let eventMatch = 0.0;
        let protocol = undefined;

        if (marketLogs.length > 0) {
            eventMatch = 1.0;
            confidence += 0.3;
            reasons.push(`Matched known marketplace events (${marketLogs.length})`);

            if (marketLogs.some(l => l.topics[0] === MARKETPLACE_EVENTS[0])) protocol = 'OpenSea (Seaport)';
            else if (marketLogs.some(l => l.topics[0] === MARKETPLACE_EVENTS[1])) protocol = 'Blur';
            else if (marketLogs.some(l => l.topics[0] === MARKETPLACE_EVENTS[2])) protocol = 'OpenSea (Legacy)';
            else if (marketLogs.some(l => l.topics[0] === MARKETPLACE_EVENTS[3] || l.topics[0] === MARKETPLACE_EVENTS[4])) protocol = 'LooksRare';
        }

        // 2. Mandatory Bidirectional Flow Gate
        if (!flow) return null as any;

        const nftOut = flow.outgoing.filter(m => ['ERC721', 'ERC1155'].includes(m.type));
        const nftIn = flow.incoming.filter(m => ['ERC721', 'ERC1155'].includes(m.type));

        // Include Native ETH in payment checks (Ignore Dust > 1000 wei)
        const paymentOut = flow.outgoing.filter(m => ['NATIVE', 'ERC20'].includes(m.type) && BigInt(m.amount) > BigInt(1000));
        const paymentIn = flow.incoming.filter(m => ['NATIVE', 'ERC20'].includes(m.type) && BigInt(m.amount) > BigInt(1000));

        let isSale = false;

        // Scenario A: User Bought NFT (Payment Out, NFT In)
        if (nftIn.length > 0 && paymentOut.length > 0) {
            isSale = true;
            confidence += 0.4;
            reasons.push('Correlated Bidirectional Flow: Bought NFT');
        }
        // Scenario B: User Sold NFT (NFT Out, Payment In)
        else if (nftOut.length > 0 && paymentIn.length > 0) {
            isSale = true;
            confidence += 0.4;
            reasons.push('Correlated Bidirectional Flow: Sold NFT');
        }

        // Fix 4 & 5: Penalties for Complexity/Correlation failure
        if (isSale) {
            const allNftContracts = new Set([...nftIn, ...nftOut].map(m => m.asset));

            // Single Collection Bonus
            if (allNftContracts.size === 1) {
                confidence += 0.15;
            }
            // Mixed Collection Penalty
            else if (allNftContracts.size > 1) {
                confidence -= 0.15;
                reasons.push('Warning: Mixed NFT Collections');
            }

            // Multiple Payment Assets Penalty (Weak Correlation)
            const paymentAssets = new Set([...paymentIn, ...paymentOut].map(m => m.asset));
            if (paymentAssets.size > 1) {
                confidence -= 0.1;
                reasons.push('Warning: Multiple Payment Assets');
            }
        } else {
            // If NOT a sale (no bidirectional flow), strict penalty
            // We strip the event confidence because events might be stray
            confidence = 0;
        }

        // 3. Fallback Logic: NFT_TRANSFER
        // If confidence for Sale is low (< 0.7) BUT we have NFT movement, return NFT_TRANSFER
        confidence = Math.min(1.0, Math.max(0.0, confidence));

        if (confidence < 0.7) {
            const hasNftMove = nftIn.length > 0 || nftOut.length > 0;

            // Explicit Fallback
            if (hasNftMove) {
                return {
                    type: TransactionType.NFT_TRANSFER,
                    confidence: 0.9, // High confidence (90) but Priority (80) means Bridge/Lending (90) override it if they match
                    breakdown: { eventMatch, tokenFlowMatch: 1.0, methodMatch: 0, addressMatch: 0, executionMatch: 1.0 },
                    protocol: undefined,
                    reasons: ['Detected NFT movement without clear payment correlation (Fallback)']
                };
            }
            return null as any;
        }

        return {
            type: TransactionType.NFT_SALE,
            confidence,
            breakdown: {
                eventMatch,
                tokenFlowMatch: 1.0,
                methodMatch: 0,
                addressMatch: 0,
                executionMatch: 1.0
            },
            protocol,
            reasons
        };
    }
}
