// src/services/classifier/core/Rule.ts
import { ClassificationContext } from './Context';
import { ConfidenceBreakdown, TransactionType } from './types';

export interface RuleResult {
    type: TransactionType;
    confidence: number;
    breakdown: ConfidenceBreakdown;
    protocol?: string; // Name of the detected protocol
    reasons: string[];
    secondary?: boolean;
    evidence?: string[];
}

export interface ClassificationRule {
    id: string; // Unique, stable ID, e.g., 'dex_uniswap_v2'
    name: string; // Human readable name
    priority: number; // Execution Order (Higher = Earlier)

    /**
     * Pure function to check if rule matches context.
     * Must not have side effects.
     */
    matches(ctx: ClassificationContext): boolean;

    /**
     * Deep evaluation of the rule to produce result.
     */
    classify(ctx: ClassificationContext): RuleResult;
}
