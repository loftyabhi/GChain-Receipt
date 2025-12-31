
import { BillService } from '../src/services/BillService';

process.env.ALCHEMY_API_KEY = 'demo';
const billService = new BillService();

// Scenario: 
// A transaction involving 0xSomeoneElse -> 0xMyConnectedWallet
// Default logic would check 0xSender (SomeoneElse) and see OUT.
// Connected Wallet logic should check 0xMyConnectedWallet and see IN.

// We can reuse the same transaction, but simulate a "connected wallet" matching the recipient.
// Tx: 0x0833... (Sender: 0x48e1..., Recipient/SmartWallet: 0x48e1..., TokenTransfer: to 0x48e1...) wait, that tx was special.
// Let's pick a simple transfer.
// Tx 0x0833... had token movement 0x82f6... -> 0x2649...
// If we say connectedWallet is 0x2649..., we should see IN.

const REQUEST = {
    txHash: '0x0833adaf46b6f6eb5084e7b2b3d6d0c10a1a7ff9a6416ee6fbe4298f60f253fe',
    chainId: 8453,
    connectedWallet: '0x264993f94caca69b6261c32757279148560ded7e' // The recipient of the token transfer
};

async function verify() {
    try {
        console.log(`Verifying with connected wallet: ${REQUEST.connectedWallet}`);
        const result = await billService.generateBill(REQUEST);

        const item = result.billData.ITEMS[0];
        console.log('Result Item:', item);

        if (item.isIn === true) {
            console.log('SUCCESS: Direction identified as IN base on connected wallet.');
        } else {
            console.log('FAILURE: Direction is still OUT.');
        }

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verify();
