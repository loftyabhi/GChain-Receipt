import { Transaction, Receipt, Log, IProtocolDetector, ProtocolMatch, TransactionType } from '../types';

const LENDING_EVENTS = {
    // Aave
    DEPOSIT: '0xde6857219544bb5b7746f48ed30be6386fefc61b2f864cacf559893bf50fd951', // Supply
    WITHDRAW: '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7',
    BORROW: '0xc6a898309e823ee50bac64e45ca8adba6690e99e7841c45d754e2a38e9019d9b',
    REPAY: '0x4cdde6e09bb755c9a5589ebaec640bbfedff1362d4b255ebf8339782b9942faa',
    LIQUIDATION: '0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286',

    // Compound
    MINT: '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
    REDEEM: '0xe5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929',
    BORROW_COMP: '0x13ed6866d4e1ee6da46f16c3d936f33f85f6b6189124208d58d43381285286a8',
    REPAY_BORROW: '0x1a2a22cb034d26d1854bdc6666a5b91fe25efbbb5dcad3b0355478d6f5c362a1',
};

const KNOWN_LENDING_POOLS: Record<string, string> = {
    '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave V2',
    '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave V3',
    '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': 'Compound Comptroller',
};

// Common aToken/cToken patterns could be checked here if we had access to TokenFlow, 
// but detect() only gets Tx + Receipt. We will infer from Logs and User Flow in Rule.
// Here we provide the Signal Confidence.

export class LendingDetector implements IProtocolDetector {
    id = 'lending';

    async detect(tx: Transaction, receipt: Receipt): Promise<ProtocolMatch | null> {
        const logs = receipt.logs;
        const to = tx.to?.toLowerCase();
        const contractAddress = receipt.contractAddress?.toLowerCase();

        // Start with 0 confidence
        let confidence = 0.0;
        let protocol = 'Lending';
        let action: 'DEPOSIT' | 'WITHDRAW' | 'BORROW' | 'REPAY' | 'LIQUIDATION' | undefined;

        // 1. Known Protocol Address (+0.35)
        if (to && KNOWN_LENDING_POOLS[to]) {
            confidence += 0.35;
            protocol = KNOWN_LENDING_POOLS[to];
        }

        // 2. Known Event Signatures (+0.25)
        const hasDeposit = logs.some(l => l.topics[0] === LENDING_EVENTS.DEPOSIT || l.topics[0] === LENDING_EVENTS.MINT);
        const hasWithdraw = logs.some(l => l.topics[0] === LENDING_EVENTS.WITHDRAW || l.topics[0] === LENDING_EVENTS.REDEEM);
        const hasBorrow = logs.some(l => l.topics[0] === LENDING_EVENTS.BORROW || l.topics[0] === LENDING_EVENTS.BORROW_COMP);
        const hasRepay = logs.some(l => l.topics[0] === LENDING_EVENTS.REPAY || l.topics[0] === LENDING_EVENTS.REPAY_BORROW);
        const hasLiquidation = logs.some(l => l.topics[0] === LENDING_EVENTS.LIQUIDATION);

        if (hasDeposit || hasWithdraw || hasBorrow || hasRepay || hasLiquidation) {
            confidence += 0.25;

            // Prioritize specific action signals if present
            if (hasLiquidation) action = 'LIQUIDATION';
            else if (hasBorrow) action = 'BORROW';
            else if (hasRepay) action = 'REPAY';
            else if (hasWithdraw) action = 'WITHDRAW';
            else if (hasDeposit) action = 'DEPOSIT';
        }

        // 3. Internal Call Target (+0.2)
        // Check if logs emitted by known lending pool (that isn't the direct target)
        const internalInteraction = logs.some(l => KNOWN_LENDING_POOLS[l.address.toLowerCase()]);
        if (internalInteraction) {
            confidence += 0.2;
            const match = logs.find(l => KNOWN_LENDING_POOLS[l.address.toLowerCase()]);
            if (match && protocol === 'Lending') protocol = KNOWN_LENDING_POOLS[match.address.toLowerCase()];
        }

        // Cap Confidence (+0.45)
        confidence = Math.min(confidence, 0.45);
        if (confidence === 0) return null;

        // Map inferred action to generic TransactionType for ProtocolMatch structure
        let type = TransactionType.LENDING_DEPOSIT; // Default
        if (action === 'WITHDRAW') type = TransactionType.LENDING_WITHDRAW;
        if (action === 'BORROW') type = TransactionType.LENDING_BORROW;
        if (action === 'REPAY') type = TransactionType.LENDING_REPAY;
        if (action === 'LIQUIDATION') type = TransactionType.LENDING_LIQUIDATION;

        return {
            name: protocol,
            confidence,
            type,
            metadata: {
                action
            }
        };
    }
}
