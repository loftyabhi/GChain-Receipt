// src/services/classifier/infrastructure/ProxyResolver.ts
import { Address, Receipt, Log } from '../core/types';

// Standard Proxy Signals
const PROXY_TOPICS = {
    // EIP-1967 Upgraded(address implementation)
    UPGRADED: '0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b',
    // BeaconUpgraded(address beacon)
    BEACON_UPGRADED: '0x1cf3b03a6cf19fa2baba4df148e9dcabedea7f8a5c07840e207e5c089be95d3e',
};

export class ProxyResolver {
    /**
     * Resolves proxy implementations using Event Heuristics.
     * (Strict offline mode - no RPC calls)
     */
    static resolve(to: Address, receipt: Receipt): Address | null {
        if (!to) return null;

        const normalizedTo = to.toLowerCase();

        // 1. Check EIP-1967 'Upgraded' Event
        // Emitted by: Transparent Proxy, UUPS, Beacon Proxy
        const upgradedLog = receipt.logs.find(l =>
            l.address.toLowerCase() === normalizedTo &&
            l.topics[0] === PROXY_TOPICS.UPGRADED
        );

        if (upgradedLog && upgradedLog.topics.length > 1) {
            // Topic 1 is the implementation address
            return this.normalizeAddress(upgradedLog.topics[1]);
        }

        // 2. Check BeaconUpgraded Event
        const beaconLog = receipt.logs.find(l =>
            l.address.toLowerCase() === normalizedTo &&
            l.topics[0] === PROXY_TOPICS.BEACON_UPGRADED
        );

        if (beaconLog && beaconLog.topics.length > 1) {
            // For Beacon proxies, the event gives the beacon address, not implementation usually?
            // EIP-1967: BeaconUpgraded(address indexed beacon)
            // We return the beacon address as "resolved target" in this case, 
            // or ideally we need the implementation the beacon points to. 
            // Without RPC, we might just track the Beacon itself as the "logic master".
            return this.normalizeAddress(beaconLog.topics[1]);
        }

        // 3. EIP-1167 Minimal Proxy?
        // Cannot detect without bytecode or creation code scanning.
        // We skip simple minimal proxies here as we have no visual/RPC confirmation.

        // 4. Fallback: Check if we have logs from OTHER addresses that might be the delegate?
        // (Hard to prove without traces).

        return null;
    }

    private static normalizeAddress(topic: string): Address {
        // Topics are 32 bytes, address is last 20 bytes
        return '0x' + topic.slice(-40).toLowerCase();
    }
}
