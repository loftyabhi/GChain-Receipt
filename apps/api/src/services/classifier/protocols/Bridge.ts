import { Transaction, Receipt, Log, IProtocolDetector, ProtocolMatch, TransactionType } from '../types';

const BRIDGE_EVENTS = {
    BRIDGE_TRANSFER_SENT: '0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e',
    BRIDGE_TRANSFER_RECEIVED: '0x1b2a7ff080b8cb6ff436ce0372e399692bbfb6d4ae5766fd8d58a7b8cc6142e6',
    MESSAGE_PASSED: '0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054', // Optimism / Base
    RELAYED_MESSAGE: '0x4641df4a962071e12719d8c8c8e5ac7fc4d97b927346a3d7a335b1f7517e133c', // Optimism / Base

    // Additional Signatures
    DEPOSIT_INITIATED: '0x35697241dfb2568469d80f845ac3253b22ab1e330a1c6827a4d57a3e7902d515', // Generic L1->L2
    WITHDRAWAL_PROVEN: '0x5824c2dd8fe164f2e518d6e3264426d40026e6ba94d9302e3392d4f3b7b25e19',  // Generic L2->L1
};

const KNOWN_BRIDGES: Record<string, string> = {
    '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1': 'Optimism Bridge',
    '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a': 'Arbitrum Bridge',
    '0x49048044d57e1c92a77f79988d21fa8faf74e97e': 'Base Bridge',
    '0xa0c68c638235ee32657e8f720a23cec1bfc77c77': 'Polygon Bridge',
    '0x401f6c983ea34274ec46f84d70b31c151321188b': 'Polygon Plasma Bridge',
    '0x72a53cdbbcc1b9efa39c834a540550e23463aacb': 'Zora Bridge',
};

// Internal Call Target Match (approximate for now without traces)
// We assume execution target check happens in Rule or Detector via resolved "to"
// The Detector is passed (tx, receipt), so we can check logs for addresses.

export class BridgeDetector implements IProtocolDetector {
    id = 'bridge';

    async detect(tx: Transaction, receipt: Receipt): Promise<ProtocolMatch | null> {
        const logs = receipt.logs;
        const to = tx.to?.toLowerCase(); // Direct to
        const contractAddress = receipt.contractAddress?.toLowerCase();

        // Use effective target if possible, but Detector interface relies on basic Tx/Receipt.
        // We will scan known addresses.

        let confidence = 0.0;
        let protocol = 'Bridge';
        let inferredDirection: 'DEPOSIT' | 'WITHDRAW' | undefined;

        // 1. Known Bridge Address (+0.35)
        if (to && KNOWN_BRIDGES[to]) {
            confidence += 0.35;
            protocol = KNOWN_BRIDGES[to];
        } else if (contractAddress && KNOWN_BRIDGES[contractAddress]) {
            confidence += 0.35;
            protocol = KNOWN_BRIDGES[contractAddress];
        }

        // 2. Event Signatures (+0.25)
        const hasBridgeEvents = logs.some(l => Object.values(BRIDGE_EVENTS).includes(l.topics[0]));
        if (hasBridgeEvents) {
            confidence += 0.25;
            if (logs.some(l => [BRIDGE_EVENTS.BRIDGE_TRANSFER_SENT, BRIDGE_EVENTS.MESSAGE_PASSED, BRIDGE_EVENTS.DEPOSIT_INITIATED].includes(l.topics[0]))) {
                inferredDirection = 'DEPOSIT';
            } else if (logs.some(l => [BRIDGE_EVENTS.BRIDGE_TRANSFER_RECEIVED, BRIDGE_EVENTS.RELAYED_MESSAGE, BRIDGE_EVENTS.WITHDRAWAL_PROVEN].includes(l.topics[0]))) {
                inferredDirection = 'WITHDRAW';
            }
        }

        // 3. Internal Call Targets (+0.2)
        // Without full traces, we check if any log was emitted by a known bridge *other* than 'to'
        // This implies an internal call interaction
        const internalBridgeInteraction = logs.some(l => KNOWN_BRIDGES[l.address.toLowerCase()]);
        if (internalBridgeInteraction) {
            confidence += 0.2;
            const logBridge = logs.find(l => KNOWN_BRIDGES[l.address.toLowerCase()]);
            if (logBridge && protocol === 'Bridge') {
                protocol = KNOWN_BRIDGES[logBridge.address.toLowerCase()];
            }
        }

        // Cap Confidence (+0.45)
        confidence = Math.min(confidence, 0.45);

        if (confidence === 0) return null;

        return {
            name: protocol,
            confidence, // "confidenceBoost" mapped to standard "confidence"
            type: inferredDirection === 'WITHDRAW' ? TransactionType.BRIDGE_WITHDRAW : TransactionType.BRIDGE_DEPOSIT,
            metadata: {
                direction: inferredDirection
            }
        };
    }
}
