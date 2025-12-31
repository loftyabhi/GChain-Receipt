
import { BillService } from '../src/services/BillService';

// Mock environment
process.env.ALCHEMY_API_KEY = 'demo'; // Use a demo key or rely on public RPCs if defined in BillService

const billService = new BillService();

const REQUEST = {
    txHash: '0x0833adaf46b6f6eb5084e7b2b3d6d0c10a1a7ff9a6416ee6fbe4298f60f253fe',
    chainId: 8453 // Base
};

async function verify() {
    try {
        console.log('Generating bill...');
        // We only care about the data, not the PDF generation (which assumes browser)
        // However, generateBill does both. We'll let it run.
        const result = await billService.generateBill(REQUEST);

        console.log('Bill Generated!');
        console.log(`Items count: ${result.billData.ITEMS.length}`);

        if (result.billData.ITEMS.length > 0) {
            console.log('SUCCESS: Token movements detected.');
            console.log(JSON.stringify(result.billData.ITEMS, null, 2));
        } else {
            console.log('FAILURE: No token movements detected.');
        }

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verify();
