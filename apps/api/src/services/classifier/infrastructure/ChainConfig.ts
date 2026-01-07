// src/services/classifier/infrastructure/ChainConfig.ts
import { Address } from '../core/types';

export enum ChainType {
    L1 = 'L1',
    L2 = 'L2',
}

export interface ChainConfig {
    chainId: number;
    type: ChainType;
    nativeTokenSymbol: string;
    nativeTokenAddress: Address; // Useful if Wrapped Native has a specific address, or just 'native'
    dustThreshold: bigint; // Chain-specific dust threshold

    // Protocol Registries (Static)
    canonicalBridges: Set<Address>;
    knownRouters: Set<Address>;
    knownLendingProtocols: Set<Address>;

    // ERC-4337 Support
    entryPoint?: Address;

    // Map of Protocol Name -> Loopup Map
    knownContracts: Map<string, Record<Address, string>>;
}

// Basic Registry (Expandable)
export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
    1: {
        chainId: 1,
        type: ChainType.L1,
        nativeTokenSymbol: 'ETH',
        nativeTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH mainnet
        dustThreshold: BigInt(100000000000000), // 0.0001 ETH (Example high threshold for Mainnet)
        canonicalBridges: new Set([
            '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1', // Optimism
            '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a', // Arbitrum
        ]),
        knownRouters: new Set([
            '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
            '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3
        ]),
        knownLendingProtocols: new Set([
            '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', // Aave V2
        ]),
        entryPoint: '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
        knownContracts: new Map(),
    },
    8453: { // Base
        chainId: 8453,
        type: ChainType.L2,
        nativeTokenSymbol: 'ETH',
        nativeTokenAddress: '0x4200000000000000000000000000000000000006', // WETH Base
        dustThreshold: BigInt(10000), // Lower on L2
        canonicalBridges: new Set([
            '0x4200000000000000000000000000000000000010', // Standard Bridge
        ]),
        knownRouters: new Set([
            '0x2626664c2603336e57b271c5c0b26f421741e481', // Uniswap Base
        ]),
        knownLendingProtocols: new Set(),
        entryPoint: '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
        knownContracts: new Map(),
    }
};

export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
    chainId: 0,
    type: ChainType.L1,
    nativeTokenSymbol: 'ETH',
    nativeTokenAddress: 'native',
    dustThreshold: BigInt(1000),
    canonicalBridges: new Set(),
    knownRouters: new Set(),
    knownLendingProtocols: new Set(),
    knownContracts: new Map(),
};
