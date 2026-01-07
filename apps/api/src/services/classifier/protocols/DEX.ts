import { Transaction, Receipt, Log, TransactionType, IProtocolDetector, ProtocolMatch } from '../types';

const DEX_EVENTS = {
    SWAP_V2: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
    SWAP_V3: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
    SWAP_BALANCER: '0x2170c741c41531aec20e7c107c24eecfdd15e69c9bb0a8dd37b1840b9e0b207b',
    TOKEN_EXCHANGE_CURVE: '0x8b3e96f2b889fa771c53c981b40daf005f63f637f1869f707052d15a3dd97140',
    MINT_V2: '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
    BURN_V2: '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496',
    MINT_V3: '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde',
    BURN_V3: '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c',
    ADD_LIQUIDITY_CURVE: '0x26f55a85081d24974e85c6c00045d0f0453991e95873f52bff0d21af4079a768',
};

const DEX_METHODS = {
    ADD_LIQUIDITY: ['0xe8e33700', '0xf305d719'], // addLiquidity
    REMOVE_LIQUIDITY: ['0xbaa2abde', '0x02751cec'], // removeLiquidity
    // Common Swap Selectors
    SWAP_EXACT_TOKENS_FOR_TOKENS: '0x38ed1739',
    SWAP_TOKENS_FOR_EXACT_TOKENS: '0x8803dbee',
    SWAP_EXACT_ETH_FOR_TOKENS: '0x7ff36ab5',
    SWAP_TOKENS_FOR_EXACT_ETH: '0x4a25d94a',
    SWAP_EXACT_TOKENS_FOR_ETH: '0x18cbafe5',
    SWAP_ETH_FOR_EXACT_TOKENS: '0xfb3bdb41',
    EXACT_INPUT_SINGLE: '0x414bf389', // Uni V3
    EXACT_OUTPUT_SINGLE: '0xdb3e2198', // Uni V3
    EXACT_INPUT: '0xc04b8d59', // Uni V3
    EXACT_OUTPUT: '0x09b81346', // Uni V3
};

const KNOWN_ROUTERS: Record<string, string> = {
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3',
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
    '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap',
    '0x11111112542d85b3ef69ae05771c2dccff4faa26': '1inch V3',
    '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch V4',
    '0x1111111254eea2514d8f0f03ce855018a9947703': '1inch V5',
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Proxy',
};

const DEX_SELECTORS = Object.values(DEX_METHODS).flat();

export class DEXDetector implements IProtocolDetector {
    id = 'dex';

    async detect(tx: Transaction, receipt: Receipt): Promise<ProtocolMatch | null> {
        const logs = receipt.logs;
        const to = tx.to?.toLowerCase();
        const input = tx.data.toLowerCase();

        // Start with 0 confidence
        let confidence = 0.0;
        let protocol = 'DEX';
        let detectedType = TransactionType.SWAP;

        // 1. Known Router Address (+0.25)
        if (to && KNOWN_ROUTERS[to]) {
            confidence += 0.25;
            protocol = KNOWN_ROUTERS[to];
        }

        // 2. Selector Matching (+0.15) - Adjusted per tuning
        // Check if input data starts with known DEX method
        const selector = input.slice(0, 10);
        if (DEX_SELECTORS.includes(selector)) {
            confidence += 0.15;
        }

        // 3. Pool Semantics (+0.15)
        const swapLogs = logs.filter(l => [
            DEX_EVENTS.SWAP_V2, DEX_EVENTS.SWAP_V3, 
            DEX_EVENTS.SWAP_BALANCER, DEX_EVENTS.TOKEN_EXCHANGE_CURVE
        ].includes(l.topics[0]));
        
        if (swapLogs.length > 0) {
            confidence += 0.15;
            // Refine Protocol Name if unknown
            if (protocol === 'DEX') {
                if (swapLogs.some(l => l.topics[0] === DEX_EVENTS.SWAP_V3)) protocol = 'Uniswap V3 Compatible';
                else if (swapLogs.some(l => l.topics[0] === DEX_EVENTS.SWAP_V2)) protocol = 'Uniswap V2 Compatible';
                else if (swapLogs.some(l => l.topics[0] === DEX_EVENTS.SWAP_BALANCER)) protocol = 'Balancer';
                else if (swapLogs.some(l => l.topics[0] === DEX_EVENTS.TOKEN_EXCHANGE_CURVE)) protocol = 'Curve';
            }
        }

        // 4. Liquidity Penalty (-0.2)
        const mintLog = logs.some(l => l.topics[0] === DEX_EVENTS.MINT_V2 || l.topics[0] === DEX_EVENTS.MINT_V3 || l.topics[0] === DEX_EVENTS.ADD_LIQUIDITY_CURVE);
        const burnLog = logs.some(l => l.topics[0] === DEX_EVENTS.BURN_V2 || l.topics[0] === DEX_EVENTS.BURN_V3);
        
        if ((mintLog || burnLog) && swapLogs.length === 0) {
            confidence -= 0.2;
            // If it's pure liquidity, we might want to change type, but here we are vetting *Swap* primarily.
            // If the user wants specific liquidity detection, that should be a separate rule/flow check.
            // For now, we penalize the "Swap" signal.
            if (mintLog) detectedType = TransactionType.ADD_LIQUIDITY;
            else if (burnLog) detectedType = TransactionType.REMOVE_LIQUIDITY;
        }

        // 5. Cap Total Boost (+0.35)
        // Ensure DEX signal is assistive, not authoritative.
        confidence = Math.min(confidence, 0.35);

        // Filter: Requires positive signal
        if (confidence <= 0) return null;

        return {
            name: protocol,
            confidence,
            type: detectedType,
        };
    }
}
