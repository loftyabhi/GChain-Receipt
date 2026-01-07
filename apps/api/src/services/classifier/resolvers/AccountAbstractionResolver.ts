// src/services/classifier/resolvers/AccountAbstractionResolver.ts
import { Transaction, Receipt, Log, ExecutionType, IExecutionResolver, Address } from '../core/types';
import { Decoder } from '../utils';

// Standard AA Signatures (ERC-4337)
const AA_SIGNATURES = {
    HANDLE_OPS: '0x1fad948c', // handleOps
    HANDLE_AGGREGATED_OPS: '0x4b1d7cf5', // handleAggregatedOps
    USER_OPERATION_EVENT: '0x49628fd147100edb3ef1d7634f6e33006d4e28293976af321d22cb2b05c751a3'
};

// Known Entry Points (v0.6, v0.7)
// TODO: Load from ChainConfig ideally, but static fallback here for resolver isolation if needed.
// However, resolver should ideally check Config. For now, logic relies on standard addresses.
const KNOWN_ENTRY_POINTS = new Set([
    '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789', // v0.6
    '0x0000000071727de22e5e9d8baf0edac6f37da032', // v0.7
]);

export interface AADetails {
    isAccountAbstraction: boolean;
    entryPoint?: Address;
    bundler?: Address;
    actualSender: Address;
}

export class AccountAbstractionResolver implements IExecutionResolver {

    /**
     * Resolves ERC-4337 Account Abstraction Usage.
     * Acts as a metadata resolver, doesn't force 'ACCOUNT_ABSTRACTION' type unless specificity allows.
     */
    async resolve(tx: Transaction, receipt: Receipt, logs: Log[]): Promise<ExecutionType> {
        // We return ExecutionType.ACCOUNT_ABSTRACTION if it's a direct bundler call?
        // Or strictly if the user intent was AA.
        // User requirements say: "Act as metadata only... If AA detected via proxy... let ExecutionResolver merge."
        // But the Interface returns `ExecutionType`.
        // We will return `ExecutionType.ACCOUNT_ABSTRACTION` if detected. 
        // The ExecutionResolver will handle precedence/merging if needed.

        const details = this.detectAA(tx, logs);
        if (details.isAccountAbstraction) {
            return ExecutionType.ACCOUNT_ABSTRACTION;
        }
        return ExecutionType.UNKNOWN;
    }

    /**
     * Internal detection logic returning rich details.
     */
    public detectAA(tx: Transaction, logs: Log[]): AADetails {
        const to = tx.to ? tx.to.toLowerCase() : '';
        const input = tx.data.toLowerCase();

        // 1. Check direct interaction with EntryPoint
        const isEntryPointCall = KNOWN_ENTRY_POINTS.has(to) &&
            (input.startsWith(AA_SIGNATURES.HANDLE_OPS) || input.startsWith(AA_SIGNATURES.HANDLE_AGGREGATED_OPS));

        if (isEntryPointCall) {
            // Determine actual sender from UserOp? Hard without decoding exec data.
            // For now, bundler is tx.from. Actual sender (User) is inside validaton logs.
            // We'll rely on events.
        }

        // 2. Check UserOperationEvent
        const aaEvent = logs.find(l =>
            l.topics[0] === AA_SIGNATURES.USER_OPERATION_EVENT &&
            KNOWN_ENTRY_POINTS.has(l.address.toLowerCase())
        );

        if (aaEvent) {
            // Event usage confirms AA even if not a direct top-level call (e.g. batch)
            // Extract sender from event topics? 
            // UserOperationEvent(bytes32 userOpHash, address indexed sender, address indexed paymaster, ...)
            // Topic 0: Sig
            // Topic 1: userOpHash (not indexed usually?) Wait, abi says:
            // event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed);
            // Topics: [Sig, userOpHash, sender, paymaster]

            let sender = '0x0000000000000000000000000000000000000000';
            if (aaEvent.topics.length >= 3) {
                sender = Decoder.normalizeAddress(aaEvent.topics[2]);
            }

            return {
                isAccountAbstraction: true,
                entryPoint: aaEvent.address.toLowerCase(),
                bundler: tx.from.toLowerCase(), // The EOA that submitted the batch
                actualSender: sender
            };
        }

        // 3. Fallback: If Direct EntryPoint call but event parsing failed?
        if (isEntryPointCall) {
            return {
                isAccountAbstraction: true,
                entryPoint: to,
                bundler: tx.from.toLowerCase(),
                actualSender: '0x0000000000000000000000000000000000000000' // Unknown without event
            };
        }

        return {
            isAccountAbstraction: false,
            actualSender: tx.from.toLowerCase() // Default to EOA
        };
    }
}
