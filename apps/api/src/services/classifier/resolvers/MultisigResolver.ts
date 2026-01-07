import { Transaction, Receipt, Log, ExecutionType, IExecutionResolver } from '../core/types';

const SAFE_SIGNATURES = {
    // execTransaction
    EXEC_TRANSACTION: '0x6a761202',
    // ExecutionSuccess(bytes32 txHash, uint256 payment)
    EXECUTION_SUCCESS: '0x442e715f626346e8c54381002da614f62bee8cf2088c564363b46925e01e4756',
    // ExecutionFailure
    EXECUTION_FAILURE: '0x23428b18acfb3ea64b08dc0c1d476c9b20e41946905b9dde7984e005723701f0'
};

const ARGENT_SIGNATURES = {
    // execute(address,bytes,uint256) (common variant)
    EXECUTE: '0xb61d27f6'
};

export class MultisigResolver implements IExecutionResolver {
    async resolve(tx: Transaction, receipt: Receipt, logs: Log[]): Promise<ExecutionType> {
        const input = tx.data.toLowerCase();
        const to = tx.to?.toLowerCase();

        // 1. Check Function Signature (Input Data)
        if (input.startsWith(SAFE_SIGNATURES.EXEC_TRANSACTION)) {
            // Confirm with event if possible, but signature is strong signal for Gnosis Safe
            return ExecutionType.MULTISIG;
        }

        if (input.startsWith(ARGENT_SIGNATURES.EXECUTE)) {
            // Argent Wallet
            return ExecutionType.MULTISIG;
        }

        // 2. Check Events (Gnosis Safe)
        // Ensure event emitted by the 'to' address
        if (to) {
            const safeEvent = logs.find(l =>
                l.address.toLowerCase() === to &&
                (l.topics[0] === SAFE_SIGNATURES.EXECUTION_SUCCESS ||
                    l.topics[0] === SAFE_SIGNATURES.EXECUTION_FAILURE)
            );

            if (safeEvent) {
                return ExecutionType.MULTISIG;
            }
        }

        // Internal Multisig? (Multisig calls another contract)
        // If 'to' is not the multisig but an event detected?
        // Typically ExecutionResolver cares about the *Primary* execution pattern.
        // If we called a contract that used a multisig internally, does the TX count as Multisig?
        // Usually NO, unless the Sender was the Multisig (Meta Transaction / Relayer).
        // Here we focus on "Did we interact with a Multisig?"
        // If tx.to IS the multisig, yes. 

        return ExecutionType.UNKNOWN;
    }
}
