const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

import { BillService } from '../src/services/BillService';

// Mock environment
// process.env.ALCHEMY_API_KEY = 'demo';
console.log('DEBUG: Alchemy Key Present:', !!process.env.ALCHEMY_API_KEY || !!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY);

const billService = new BillService();

// The specific transaction reported by the user
// Tx: 0xaaefb82fe8e36d6c1362600b6f0f54d5b6c54f443f0030c509d8493746d52aee
// Chain: 1 (Ethereum)
// Expectation: If connectedWallet is the recipient, it should be IN.

const REQUEST: { txHash: string; chainId: number; connectedWallet?: string } = {
    txHash: '0xbb6e015fe91dacb66e11a5ec5ba1f3ac080fc7c7abef3045590507a57e87a775',
    chainId: 8453,
    connectedWallet: '0xb37a63ffebf99a9d49df93647caee5f9ef046b88' // matches loftyabhisek.base.eth from prev context
};

async function verify() {
    try {
        const fs = require('fs');
        const path = require('path');

        console.log(`Testing Tx: ${REQUEST.txHash}`);
        console.log(`Connected Wallet (Input): ${REQUEST.connectedWallet}`);

        const result = await billService.generateBill(REQUEST);
        const bill = result.billData;

        console.log(`--- Transaction Details ---`);
        console.log(`From: ${bill.FROM_ADDRESS}`);
        console.log(`To: ${bill.TO_ADDRESS}`);
        console.log(`---------------------------`);

        const output = {
            from: bill.FROM_ADDRESS,
            to: bill.TO_ADDRESS,
            items: bill.ITEMS,
            fee_usd: bill.TOTAL_FEE_USD,
            fee_native: bill.TOTAL_FEE_ETH,
            native_price_source: bill.PRICE_SOURCE
        };

        const jsonPath = path.join(__dirname, 'reproduce_result.json');
        fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
        console.log(`Output written to ${jsonPath}`);

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verify();
