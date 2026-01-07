import { ClassificationEngine } from './classifier/core/Engine';
import { TransactionType, ExecutionType, ClassificationResult, TransactionEnvelopeType } from './classifier/core/types';

// Re-export types for consumers
export { TransactionType, ExecutionType, TransactionEnvelopeType, ClassificationResult };

const engine = new ClassificationEngine();

export class TransactionClassifierService {
    /**
     * Main classification method
     */
    async classify(
        receipt: any,
        transaction: any,
        chainId: number,
    ): Promise<ClassificationResult> {
        // 1. Safety & Orchestration: Explicit Engine Call
        // We pass chainId and txHash (via transaction object) to ensure cache correctness logic in Engine triggers correctly.
        const result = await engine.classify(transaction, receipt, chainId);

        // 2. Final Output Guards
        // If Engine returned UNCLASSIFIED_COMPLEX, propagate immediately.
        if (result.functionalType === TransactionType.UNCLASSIFIED_COMPLEX) {
            return result;
        }

        // If primary confidence is below threshold (0.55), force UNCLASSIFIED_COMPLEX
        // This acts as a final safety net downstream of the Engine.
        if (result.confidence.score < 0.55) {
            // Preserve secondary results if they exist (verbatim)
            return {
                ...result,
                functionalType: TransactionType.UNCLASSIFIED_COMPLEX,
                protocol: undefined, // Clear protocol if low confidence
                confidence: {
                    ...result.confidence,
                    reasons: ['Low confidence fallback (Classifier Guard)', ...result.confidence.reasons]
                }
            };
        }

        // 3. Return accepted result verbatim
        // (No re-ranking, no re-computation)
        return result;
    }

    /**
     * Get human-readable label for transaction type
     */
    getTypeLabel(type: TransactionType): string {
        const typeMap: Record<string, string> = {
            [TransactionType.TOKEN_TRANSFER]: 'Token Transfer',
            [TransactionType.TOKEN_APPROVAL]: 'Token Approval',
            [TransactionType.TOKEN_MINT]: 'Token Mint',
            [TransactionType.TOKEN_BURN]: 'Token Burn',
            [TransactionType.SWAP]: 'Swap',
            [TransactionType.ADD_LIQUIDITY]: 'Add Liquidity',
            [TransactionType.REMOVE_LIQUIDITY]: 'Remove Liquidity',
            [TransactionType.NFT_MINT]: 'NFT Mint',
            [TransactionType.NFT_TRANSFER]: 'NFT Transfer',
            [TransactionType.NFT_SALE]: 'NFT Sale',
            [TransactionType.NFT_LISTING]: 'NFT Listing',
            [TransactionType.NFT_CANCEL_LISTING]: 'Cancel NFT Listing',
            [TransactionType.NFT_BID]: 'NFT Bid',
            [TransactionType.LENDING_DEPOSIT]: 'Lending Deposit',
            [TransactionType.LENDING_WITHDRAW]: 'Lending Withdraw',
            [TransactionType.LENDING_BORROW]: 'Borrow',
            [TransactionType.LENDING_REPAY]: 'Repay Loan',
            [TransactionType.LENDING_LIQUIDATION]: 'Liquidation',
            [TransactionType.STAKING_DEPOSIT]: 'Stake',
            [TransactionType.STAKING_WITHDRAW]: 'Unstake',
            [TransactionType.STAKING_CLAIM_REWARDS]: 'Claim Staking Rewards',
            [TransactionType.BRIDGE_DEPOSIT]: 'Bridge Deposit',
            [TransactionType.BRIDGE_WITHDRAW]: 'Bridge Withdraw',
            [TransactionType.CONTRACT_DEPLOYMENT]: 'Contract Deployment',
            [TransactionType.CONTRACT_INTERACTION]: 'Contract Interaction',
            [TransactionType.NATIVE_TRANSFER]: 'Native Transfer',
            [TransactionType.BULK_TRANSFER]: 'Bulk Transfer',
            [TransactionType.GOVERNANCE_VOTE]: 'Governance Vote',
            [TransactionType.GOVERNANCE_PROPOSAL]: 'Create Proposal',
            [TransactionType.GOVERNANCE_DELEGATION]: 'Delegate Votes',
            [TransactionType.GOVERNANCE_EXECUTION]: 'Execute Proposal',
            [TransactionType.L2_DEPOSIT]: 'L2 Deposit',
            [TransactionType.L2_WITHDRAWAL]: 'L2 Withdrawal',
            [TransactionType.L2_PROVE_WITHDRAWAL]: 'Prove L2 Withdrawal',
            [TransactionType.L2_FINALIZE_WITHDRAWAL]: 'Finalize L2 Withdrawal',
            [TransactionType.UNCLASSIFIED_COMPLEX]: 'Complex Transaction',
            [TransactionType.UNKNOWN]: 'Unknown Transaction',
        };

        return typeMap[type] || 'Unknown';
    }

    /**
     * Get emoji icon for transaction type
     */
    getTypeIcon(type: TransactionType): string {
        const iconMap: Record<string, string> = {
            [TransactionType.TOKEN_TRANSFER]: '↔',
            [TransactionType.TOKEN_APPROVAL]: '✓',
            [TransactionType.TOKEN_MINT]: '+',
            [TransactionType.TOKEN_BURN]: '×',
            [TransactionType.SWAP]: '↔',
            [TransactionType.ADD_LIQUIDITY]: '+',
            [TransactionType.REMOVE_LIQUIDITY]: '-',
            [TransactionType.NFT_MINT]: '◆',
            [TransactionType.NFT_TRANSFER]: '→',
            [TransactionType.NFT_SALE]: '◆',
            [TransactionType.NFT_LISTING]: '≡',
            [TransactionType.NFT_CANCEL_LISTING]: '×',
            [TransactionType.NFT_BID]: '●',
            [TransactionType.LENDING_DEPOSIT]: '↓',
            [TransactionType.LENDING_WITHDRAW]: '↑',
            [TransactionType.LENDING_BORROW]: '↓',
            [TransactionType.LENDING_REPAY]: '↑',
            [TransactionType.LENDING_LIQUIDATION]: '!',
            [TransactionType.STAKING_DEPOSIT]: '■',
            [TransactionType.STAKING_WITHDRAW]: '□',
            [TransactionType.STAKING_CLAIM_REWARDS]: '+',
            [TransactionType.BRIDGE_DEPOSIT]: '→',
            [TransactionType.BRIDGE_WITHDRAW]: '←',
            [TransactionType.CONTRACT_DEPLOYMENT]: '⚙',
            [TransactionType.CONTRACT_INTERACTION]: '⚙',
            [TransactionType.NATIVE_TRANSFER]: '↔',
            [TransactionType.BULK_TRANSFER]: '≡',
            [TransactionType.GOVERNANCE_VOTE]: '✓',
            [TransactionType.GOVERNANCE_PROPOSAL]: '≡',
            [TransactionType.GOVERNANCE_DELEGATION]: '→',
            [TransactionType.GOVERNANCE_EXECUTION]: '!',
            [TransactionType.L2_DEPOSIT]: '↓',
            [TransactionType.L2_WITHDRAWAL]: '↑',
            [TransactionType.L2_PROVE_WITHDRAWAL]: '?',
            [TransactionType.L2_FINALIZE_WITHDRAWAL]: '✓',
            [TransactionType.UNCLASSIFIED_COMPLEX]: '?',
            [TransactionType.UNKNOWN]: '?',
        };

        return iconMap[type] || '?';
    }
}

// Export singleton instance
export const transactionClassifier = new TransactionClassifierService();
