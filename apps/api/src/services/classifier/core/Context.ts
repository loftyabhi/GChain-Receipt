// src/services/classifier/core/Context.ts
import { Transaction, Receipt, Address, TokenFlow, TokenMovement } from './types';
import { ChainConfig, CHAIN_CONFIGS, DEFAULT_CHAIN_CONFIG } from '../infrastructure/ChainConfig';

export class ClassificationContext {
    public readonly chain: ChainConfig;
    public readonly effectiveTo: Address;
    public readonly isProxy: boolean;
    public readonly proxyImplementation?: Address;
    public readonly internalTransactions: readonly any[];

    constructor(
        public readonly tx: Transaction,
        public readonly receipt: Receipt,
        public readonly flow: TokenFlow,
        chainId: number,
        executionDetails: { effectiveTo: Address, isProxy: boolean, implementation?: Address },
        internalTransactions: any[] = []
    ) {
        this.chain = Object.freeze(CHAIN_CONFIGS[chainId] || { ...DEFAULT_CHAIN_CONFIG, chainId });
        this.effectiveTo = executionDetails.effectiveTo.toLowerCase();
        this.isProxy = executionDetails.isProxy;
        this.proxyImplementation = executionDetails.implementation?.toLowerCase();
        this.internalTransactions = Object.freeze([...internalTransactions]);

        // Deep Freeze Core Objects
        // We assume inputs might be used elsewhere, so we freeze the properties we hold? 
        // Or we freeze the object itself if we own it. 
        // Best practice for safety: Freeze THIS instance and its held references if possible without side effects to caller.
        // But caller gives us references. 
        // We will freeze our own instance at the end.

        // Defensively freeze inputs to prevent mutation downstream?
        // Risky if caller reuses them. But Rule Engine implies ownership during classification.
        // We'll trust strict rules not to mutate references, but enforce `Object.isFrozen(ctx)` check by freezing `this`.

        Object.freeze(this);
    }

    /**
     * Pure Helper: Get Net Flow for User
     * Returns: { incoming: TokenMovement[], outgoing: TokenMovement[] }
     * Guaranteed pure, no caching.
     */
    getUserFlow(address: Address): { incoming: TokenMovement[], outgoing: TokenMovement[] } | null {
        if (!this.flow || !address) return null;
        const normalized = address.toLowerCase();
        const userFlow = this.flow[normalized];
        if (!userFlow) return null;

        return {
            incoming: [...userFlow.incoming], // Return copies
            outgoing: [...userFlow.outgoing]
        };
    }

    /**
     * Helper to check logic contract
     */
    isContract(protocolName: string): boolean {
        // Placeholder for config lookup
        return false;
    }
}
