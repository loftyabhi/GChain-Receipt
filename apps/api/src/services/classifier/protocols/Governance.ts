// src/services/classifier/protocols/Governance.ts
import { Transaction, Receipt, IProtocolDetector, ProtocolMatch, TransactionType } from '../core/types';

export class GovernanceDetector implements IProtocolDetector {
    public id = 'governance';

    // Known Governance Function Selectors - +0.2 Confidence
    private static readonly SELECTORS = {
        CAST_VOTE: '0x56781388', // castVote(uint256)
        CAST_VOTE_WITH_REASON: '0x7b3c71d3', // castVoteWithReason(uint256,string)
        PROPOSE: '0xda95691a', // propose(address[],uint256[],string[],bytes[],string)
        DELEGATE: '0x5c19a95c', // delegate(address)
        EXECUTE: '0xfe0d94c1', // execute(uint256)
    };

    // Known Governance Events - +0.25 Confidence
    private static readonly EVENTS = {
        // VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)
        VOTE_CAST: '0xb8e138887d0aa13bab447e82de9dcd1777061d0d18dcbc747a82b7db5761c56b',
        // ProposalCreated(...)
        PROPOSAL_CREATED: '0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0',
        // DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)
        DELEGATE_CHANGED: '0x3134e8a2e6d97e929a7e54011ea5485d7d196dd5f0ba4d4ef95803e8e3fc257f',
        // DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance)
        DELEGATE_VOTES_CHANGED: '0xdec2bacdd2f05b59de34da9b523dff8db32c408b72aa0a4171cd01d7445f8ef4',
        // ProposalExecuted(uint256 id)
        PROPOSAL_EXECUTED: '0x712ae1383f79ac853f8d882153778e0260ef8f03b50e394fe5fdb00bed72c93d'
    };

    // Known Governance Contracts (+0.35) - Ideally loaded from ChainConfig
    // For now, empty set to comply with "Known governance contract address -> +0.35" if matched
    private static readonly KNOWN_CONTRACTS = new Set<string>([
        // Example: GovernorAlpha, GovernorBravo common addresses could go here
    ]);

    async detect(tx: Transaction, receipt: Receipt): Promise<ProtocolMatch | null> {
        let confidenceBoost = 0;
        let action: 'VOTE' | 'PROPOSE' | 'DELEGATE' | 'EXECUTE' | undefined;

        const input = tx.data.toLowerCase();
        const to = tx.to ? tx.to.toLowerCase() : '';

        // 1. Selector Match (+0.2)
        if (input.startsWith(GovernanceDetector.SELECTORS.CAST_VOTE) ||
            input.startsWith(GovernanceDetector.SELECTORS.CAST_VOTE_WITH_REASON)) {
            confidenceBoost += 0.2;
            action = 'VOTE';
        } else if (input.startsWith(GovernanceDetector.SELECTORS.PROPOSE)) {
            confidenceBoost += 0.2;
            action = 'PROPOSE';
        } else if (input.startsWith(GovernanceDetector.SELECTORS.DELEGATE)) {
            confidenceBoost += 0.2;
            action = 'DELEGATE';
        } else if (input.startsWith(GovernanceDetector.SELECTORS.EXECUTE)) {
            confidenceBoost += 0.2;
            action = 'EXECUTE';
        }

        // 2. Event Match (+0.25 matched once)
        for (const log of receipt.logs) {
            const topic0 = log.topics[0];
            if (topic0 === GovernanceDetector.EVENTS.VOTE_CAST) {
                confidenceBoost += 0.25;
                if (!action) action = 'VOTE';
            } else if (topic0 === GovernanceDetector.EVENTS.PROPOSAL_CREATED) {
                confidenceBoost += 0.25;
                if (!action) action = 'PROPOSE';
            } else if (topic0 === GovernanceDetector.EVENTS.DELEGATE_CHANGED ||
                topic0 === GovernanceDetector.EVENTS.DELEGATE_VOTES_CHANGED) {
                confidenceBoost += 0.25;
                if (!action) action = 'DELEGATE';
            } else if (topic0 === GovernanceDetector.EVENTS.PROPOSAL_EXECUTED) {
                confidenceBoost += 0.25;
                if (!action) action = 'EXECUTE';
            }
        }

        // 3. Known Contract (+0.35)
        if (GovernanceDetector.KNOWN_CONTRACTS.has(to)) {
            confidenceBoost += 0.35;
        }

        // Cap Confidence Boost
        confidenceBoost = Math.min(confidenceBoost, 0.45);

        // Mandatory Guard: If no signal, return null (0 boost)
        if (confidenceBoost === 0) {
            return null;
        }

        return {
            name: 'Governance',
            confidence: confidenceBoost,
            type: TransactionType.GOVERNANCE_VOTE, // Default, will be refined by Rule
            metadata: { action }
        };
    }
}
