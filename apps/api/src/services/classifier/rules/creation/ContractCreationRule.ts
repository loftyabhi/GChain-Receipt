// src/services/classifier/rules/creation/ContractCreationRule.ts
import { ClassificationRule, RuleResult } from '../../core/Rule';
import { ClassificationContext } from '../../core/Context';
import { TransactionType } from '../../core/types';

export class ContractCreationRule implements ClassificationRule {
    public id = 'core_contract_creation';
    public name = 'Contract Creation';
    public priority = 100; // Hard Requirement: Highest Priority

    public matches(ctx: ClassificationContext): boolean {
        // Strict Gate: Only match if tx.to is explicitly null/undefined (Native Creation)
        // AND receipt confirms creation.
        // We reject any "Creation via Factory" in this rule (those are Contract Calls usually).

        // Note: ClassificationContext.tx.to is nullable.
        // If tx.to exists, it is NOT a native creation.
        if (ctx.tx.to) return false;

        // Double check receipt
        if (!ctx.receipt.contractAddress) return false;

        return true;
    }

    public classify(ctx: ClassificationContext): RuleResult {
        // Safety: matches() guarantees !tx.to

        return {
            type: TransactionType.CONTRACT_DEPLOYMENT,
            confidence: 1.0, // Hard Requirement: 1.0 Confidence
            breakdown: {
                executionMatch: 1.0,
                tokenFlowMatch: 0, // Irrelevant
                methodMatch: 0,
                addressMatch: 0,
                eventMatch: 0
            },
            protocol: undefined, // Native
            reasons: [
                'Native Contract Deployment (to=null)',
                `Deployed Address: ${ctx.receipt.contractAddress}`
            ]
            // No secondary results allowed.
        };
    }
}
