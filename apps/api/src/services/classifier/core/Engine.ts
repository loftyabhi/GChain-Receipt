// src/services/classifier/core/Engine.ts
import {
    ClassificationResult,
    Transaction,
    Receipt,
    TransactionType,
    ExecutionType
} from './types';
import { ClassificationContext } from './Context';
import { TokenFlowAnalyzer } from '../infrastructure/TokenFlow';
import { ExecutionResolver } from '../infrastructure/ExecutionResolver';
import { ClassificationRule, RuleResult } from './Rule';

// Import Rules
import { SwapRule } from '../rules/dex/SwapRule';
import { NFTSaleRule } from '../rules/nft/NFTSaleRule';
import { BridgeRule } from '../rules/bridge/BridgeRule';
import { LendingRule } from '../rules/lending/LendingRule';
import { TransferRule } from '../rules/transfer/TransferRule';
import { ContractCreationRule } from '../rules/creation/ContractCreationRule';
import { GovernanceRule } from '../rules/governance/GovernanceRule';

interface ExtendedRuleResult extends RuleResult {
    priority: number;
    ruleId: string;
}

export class ClassificationEngine {
    private rules: ClassificationRule[] = [];
    private resultCache = new Map<string, ClassificationResult>();
    // Cache size limit to prevent memory leaks
    private readonly MAX_CACHE_SIZE = 100;
    // Global minimum confidence threshold
    private readonly MIN_CONFIDENCE = 0.55;

    constructor() {
        this.registerRules();
    }

    private registerRules() {
        // Register ALL rules
        const rawRules = [
            new ContractCreationRule(),
            new BridgeRule(),
            new LendingRule(),
            new GovernanceRule(),
            new SwapRule(),
            new NFTSaleRule(),
            new TransferRule()
        ];

        // STRICT PRIORITY SORT: Higher Priority First
        this.rules = rawRules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Helper to deeply freeze the context to maintain immutability across rules
     */
    private freezeContext(ctx: any) {
        if (ctx && typeof ctx === 'object' && !Object.isFrozen(ctx)) {
            Object.freeze(ctx);
            Object.keys(ctx).forEach(prop => this.freezeContext(ctx[prop]));
        }
        return ctx;
    }

    /**
     * Normalizes confidence score to 0.0 - 1.0 range
     */
    private normalizeConfidence(score: number): number {
        return Math.min(1, Math.max(0, score));
    }

    public async classify(tx: Transaction, receipt: Receipt, chainId: number): Promise<ClassificationResult> {
        // 0. Check Cache (Deterministic Rule Engine Result Caching)
        // Caveat 1: Cache Key Must Include Chain ID
        const cacheKey = `${chainId}:${tx.hash}`;
        if (this.resultCache.has(cacheKey)) {
            return this.resultCache.get(cacheKey)!;
        }

        // --- PHASE 1: Normalization & Execution Resolution ---
        // Resolves Proxies, Multisigs, and Contracts BEFORE any rule sees the tx.
        const executionDetails = await ExecutionResolver.resolve(tx, receipt);

        // --- PHASE 2: Log Decoding & Token Flow ---
        // Captures Native, ERC20, ERC721 movements
        const flow = TokenFlowAnalyzer.analyze(receipt.logs, tx.value, tx.from, tx.to, []);

        // --- PHASE 3: Context Assembly (Immutable/Frozen) ---
        const ctx = new ClassificationContext(
            tx,
            receipt,
            flow,
            chainId,
            executionDetails
        );
        // Enforce strict immutability
        this.freezeContext(ctx);

        // --- PHASE 4: Rule Evaluation (Evaluate All) ---
        const candidates: ExtendedRuleResult[] = [];

        interface DebugTraceEntry {
            rule: string;
            priority: number;
            matched: boolean;
            classified: boolean;
            confidence?: number;
            error?: string;
        }
        const debugTrace: DebugTraceEntry[] = [];
        const finalExecutionType = executionDetails.isProxy ? ExecutionType.RELAYED : ExecutionType.DIRECT;

        // Loop Rules
        for (const rule of this.rules) {
            const entry: DebugTraceEntry = {
                rule: rule.id,
                priority: rule.priority,
                matched: false,
                classified: false
            };

            // 1. Check Applicability
            if (!rule.matches(ctx)) {
                debugTrace.push(entry);
                continue;
            }

            entry.matched = true;

            // 2. Evaluate & Classify
            try {
                const res = rule.classify(ctx);
                if (res) {
                    // Caveat 2: Contract Creation Bypass
                    if (res.type === TransactionType.CONTRACT_DEPLOYMENT) {
                        // Return Immediately - Deterministic Semantic
                        const result: ClassificationResult = {
                            functionalType: TransactionType.CONTRACT_DEPLOYMENT,
                            executionType: finalExecutionType,
                            confidence: {
                                score: 1.0,
                                reasons: ['Deterministic Contract Creation (Target Null/Deployment)']
                            },
                            details: {
                                protocol: 'Contract Deployment',
                                ...executionDetails,
                                debugTrace: process.env.DEBUG_CLASSIFIER ? debugTrace : undefined
                            }
                        };

                        this.cacheResult(cacheKey, result);
                        return result;
                    }

                    const normalizedScore = this.normalizeConfidence(res.confidence);

                    // Only consider results meeting the global threshold
                    if (normalizedScore >= this.MIN_CONFIDENCE) {
                        candidates.push({
                            ...res,
                            confidence: normalizedScore,
                            priority: rule.priority,
                            ruleId: rule.id
                        });
                    }

                    entry.classified = true;
                    entry.confidence = normalizedScore;
                    debugTrace.push(entry);
                } else {
                    debugTrace.push(entry);
                }
            } catch (e: any) {
                entry.error = e.message;
                debugTrace.push(entry);
            }
        }

        // --- PHASE 5: Selection & Conflict Resolution ---

        // Sort by Confidence DESC, then Priority DESC
        candidates.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return b.priority - a.priority;
        });

        // Detect and Penalize Conflicting Signals
        if (candidates.length > 1) {
            const top = candidates[0];
            const runnerUp = candidates[1];
            // If the difference is small (< 10%), dampen the confidence of the top result
            if ((top.confidence - runnerUp.confidence) < 0.1) {
                top.confidence *= 0.9;
                // Since confidence changed, we must re-sort to ensure correctness
                candidates.sort((a, b) => {
                    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
                    return b.priority - a.priority;
                });
            }
        }

        const bestMatch = candidates[0];

        let finalResult: ClassificationResult;

        // Check if we have a valid winner after penalty
        if (bestMatch && bestMatch.confidence >= this.MIN_CONFIDENCE) {
            // "Secondary Matches" (Non-breaking) - Keep other high-confidence matches
            // Caveat 3: Secondary Results Must Be Non-Recursive (mapToResult handles this)
            const secondaryMatches = candidates.slice(1).map(c => this.mapToResult(c, executionDetails, finalExecutionType));

            finalResult = {
                functionalType: bestMatch.type,
                executionType: finalExecutionType,
                confidence: {
                    score: bestMatch.confidence,
                    reasons: bestMatch.reasons
                },
                details: {
                    protocol: bestMatch.protocol,
                    ...executionDetails, // Include proxy details in output
                    debugTrace: process.env.DEBUG_CLASSIFIER ? debugTrace : undefined
                },
                protocol: bestMatch.protocol,
                secondary: secondaryMatches.length > 0 ? secondaryMatches : undefined
            };
        } else {
            // Fallback Logic
            if (receipt.status !== 0) {
                // Transaction succeeded but no rule matched with high confidence
                const topNearMisses = debugTrace.filter(e => e.matched).map(e => `${e.rule} (${e.confidence?.toFixed(2) || 'N/A'})`);

                finalResult = {
                    functionalType: TransactionType.UNCLASSIFIED_COMPLEX,
                    executionType: finalExecutionType,
                    confidence: {
                        score: 0.3, // Low confidence fallback
                        reasons: [
                            'No rule met global confidence threshold',
                            `Threshold: ${this.MIN_CONFIDENCE}`,
                            `Candidates found: ${candidates.length}`,
                            ...(topNearMisses.length > 0 ? [`Near misses: ${topNearMisses.join(', ')}`] : [])
                        ]
                    },
                    details: {
                        protocol: 'Unknown Protocol',
                        ...executionDetails,
                        debugTrace: process.env.DEBUG_CLASSIFIER ? debugTrace : undefined
                    }
                };
            } else {
                // Transaction Failed
                finalResult = {
                    functionalType: TransactionType.UNKNOWN,
                    executionType: ExecutionType.UNKNOWN,
                    confidence: {
                        score: 0,
                        reasons: [
                            'Transaction Failed (Status 0)',
                            `Execution: ${executionDetails.resolutionMethod}`
                        ]
                    },
                    details: {
                        ...executionDetails,
                        debugTrace: process.env.DEBUG_CLASSIFIER ? debugTrace : undefined
                    }
                };
            }
        }

        this.cacheResult(cacheKey, finalResult);

        return finalResult;
    }

    private cacheResult(key: string, result: ClassificationResult) {
        if (this.resultCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.resultCache.keys().next().value;
            if (firstKey) this.resultCache.delete(firstKey);
        }
        this.resultCache.set(key, result);
    }

    private mapToResult(match: ExtendedRuleResult, execDetails: any, execType: ExecutionType): ClassificationResult {
        return {
            functionalType: match.type,
            executionType: execType,
            confidence: {
                score: match.confidence,
                reasons: match.reasons
            },
            details: {
                protocol: match.protocol,
                ...execDetails
            },
            protocol: match.protocol,
            secondary: undefined // Caveat 3: Explicitly undefined to prevent recursion
        };
    }
}
