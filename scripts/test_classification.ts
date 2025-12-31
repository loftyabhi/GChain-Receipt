
import { transactionClassifier, TransactionType, TransactionEnvelopeType } from '../src/services/TransactionClassifier';

// Mock Signatures
const EVENTS = {
    USER_OPERATION_EVENT: '0x49628fd147100edb3ef1d7634f6e33006d4e28293976af321d22cb2b05c751a3',
    EXECUTION_SUCCESS: '0x442e715f626346e8c54381002da614f62bee8cf2088c564363b46925e01e4756',
    TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
};

const METHODS = {
    EXEC_TRANSACTION: '0x6a761202',
    HANDLE_OPS: '0x1fad948c'
};

const CONTRACTS = {
    ENTRY_POINT: '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'
};

async function test() {
    console.log('Running Transaction Classification Tests...\n');

    const failures: string[] = [];

    // Test 1: L2 EIP-1559 Envelope
    try {
        const tx = { type: 2, value: 0n, data: '0x', to: '0x1234567890123456789012345678901234567890' }; // Valid to address
        const receipt = { logs: [] };
        const result = await transactionClassifier.classify(receipt, tx, 1);
        if (result.envelopeType !== TransactionEnvelopeType.EIP1559) {
            failures.push(`Test 1 Failed: Expected EIP1559 envelope, got ${result.envelopeType}`);
        }
        console.log(`Test 1 (EIP-1559): ${result.envelopeType === TransactionEnvelopeType.EIP1559 ? 'PASS' : 'FAIL'}`);
    } catch (e) {
        failures.push(`Test 1 Error: ${e}`);
    }

    // Test 2: Multisig Execution
    try {
        const tx = { type: 2, data: METHODS.EXEC_TRANSACTION + '0000000000000000000000000000000000000000000000000000000000000000', to: '0xSafeAddressSafeAddressSafeAddressSafeAdd' };
        const receipt = {
            logs: [{ topics: [EVENTS.EXECUTION_SUCCESS] }]
        };
        const result = await transactionClassifier.classify(receipt, tx, 1);
        if (result.type !== TransactionType.MULTISIG_EXECUTION) {
            failures.push(`Test 2 Failed: Expected MULTISIG_EXECUTION, got ${result.type}`);
        }
        console.log(`Test 2 (Multisig): ${result.type === TransactionType.MULTISIG_EXECUTION ? 'PASS' : 'FAIL'}`);
    } catch (e) {
        failures.push(`Test 2 Error: ${e}`);
    }

    // Test 3: Account Abstraction
    try {
        const tx = { type: 2, data: METHODS.HANDLE_OPS + '0000000000000000000000000000000000000000000000000000000000000000', to: CONTRACTS.ENTRY_POINT };
        const receipt = {
            logs: [{ topics: [EVENTS.USER_OPERATION_EVENT] }]
        };
        const result = await transactionClassifier.classify(receipt, tx, 1);
        if (result.type !== TransactionType.ACCOUNT_ABSTRACTION) {
            failures.push(`Test 3 Failed: Expected ACCOUNT_ABSTRACTION, got ${result.type}`);
        }
        console.log(`Test 3 (Account Abstraction): ${result.type === TransactionType.ACCOUNT_ABSTRACTION ? 'PASS' : 'FAIL'}`);
    } catch (e) {
        failures.push(`Test 3 Error: ${e}`);
    }

    // Test 4: EIP-4844 Blob Transaction
    try {
        const tx = { type: 3, value: 0n, data: '0x', to: '0x1234567890123456789012345678901234567890' };
        const receipt = { logs: [] };
        const result = await transactionClassifier.classify(receipt, tx, 1);
        if (result.envelopeType !== TransactionEnvelopeType.EIP4844) {
            failures.push(`Test 4 Failed: Expected EIP4844 envelope, got ${result.envelopeType}`);
        }
        console.log(`Test 4 (EIP-4844): ${result.envelopeType === TransactionEnvelopeType.EIP4844 ? 'PASS' : 'FAIL'}`);
    } catch (e) {
        failures.push(`Test 4 Error: ${e}`);
    }

    if (failures.length > 0) {
        console.error('\nFailures:');
        failures.forEach(f => console.error(f));
        process.exit(1);
    } else {
        console.log('\nAll tests passed successfully!');
    }
}

test().catch(console.error);
