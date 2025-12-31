import axios from 'axios';

interface PriceData {
    price: number;
    source: string;
    timestamp: number;
}

export class PriceOracleService {
    private readonly coingeckoUrl = 'https://api.coingecko.com/api/v3';
    private readonly defillamaUrl = 'https://coins.llama.fi/prices/current';
    private readonly coincapUrl = 'https://api.coincap.io/v2';

    /**
     * Get historical price for a token at a specific timestamp.
     * @param chainId The chain ID (e.g., 1 for ETH, 8453 for Base).
     * @param tokenAddress The token address (or 'native' for ETH).
     * @param timestamp Unix timestamp in seconds.
     */
    async getPrice(chainId: number, tokenAddress: string, timestamp: number, blockNumber?: number): Promise<PriceData> {

        // 1. Try Alchemy (High quality, but requires Key & limited chains)
        if (blockNumber) {
            try {
                return await this.getAlchemyPrice(chainId, tokenAddress, blockNumber);
            } catch (error: any) {
                // Silently fail to fallback
                // console.warn('Alchemy failed, trying DeFiLlama...');
            }
        }

        // 2. Try DeFiLlama (Best for reliability & free coverage)
        try {
            return await this.getDefiLlamaPrice(chainId, tokenAddress, timestamp);
        } catch (error) {
            console.warn('DeFiLlama failed, trying Coingecko...');
        }

        // 3. Try Coingecko (Good backup, but rate-limited)
        try {
            return await this.getCoingeckoPrice(chainId, tokenAddress, timestamp);
        } catch (error) {
            console.warn('Coingecko failed.');
        }

        // 4. Fail gracefully
        console.warn('All price sources failed. Returning 0.');
        return {
            price: 0,
            source: 'None',
            timestamp: timestamp
        };
    }

    private async getAlchemyPrice(chainId: number, tokenAddress: string, blockNumber: number): Promise<PriceData> {
        const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
        if (!apiKey) throw new Error('No Alchemy API Key found');

        // Alchemy RPC URL Mapping
        let rpcUrl = '';
        switch (chainId) {
            case 1: rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`; break;
            case 8453: rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${apiKey}`; break;
            case 137: rpcUrl = `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`; break;
            case 10: rpcUrl = `https://opt-mainnet.g.alchemy.com/v2/${apiKey}`; break;
            case 42161: rpcUrl = `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`; break;
            default: throw new Error('Chain not supported by Alchemy RPC');
        }

        // Resolve Native to Wrapped
        let queryAddress = tokenAddress;
        if (tokenAddress === 'native') {
            const wrapped = this.getWrappedNativeAddress(chainId);
            if (wrapped) queryAddress = wrapped;
            else throw new Error('No Wrapped mapping for Native token');
        }

        // JSON-RPC Call: alchemy_getTokenPrice
        const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenPrice',
            params: [
                queryAddress,
                `0x${blockNumber.toString(16)}` // Block Number in Hex
            ]
        });

        if (response.data.error) {
            throw new Error(`RPC Error: ${response.data.error.message}`);
        }

        const result = response.data.result;
        if (!result || !result.price) {
            throw new Error('Price not found in Alchemy response');
        }

        return {
            price: parseFloat(result.price),
            source: 'Alchemy (Historical)',
            timestamp: 0 // Not returned by RPC, but we know it corresponds to the block
        };
    }

    private getAlchemyNetwork(chainId: number): string | null {
        switch (chainId) {
            case 1: return 'eth-mainnet';
            case 137: return 'polygon-mainnet';
            case 10: return 'opt-mainnet';
            case 42161: return 'arb-mainnet';
            case 8453: return 'base-mainnet';
            // BSC/Avalanche not typically supported on Alchemy standard tiers or follow different naming?
            // Alchemy supports Astar, zkEVM, etc.
            // For safety, return null for unsupported to fallback to Coingecko.
            default: return null;
        }
    }

    private async getCoingeckoPrice(chainId: number, tokenAddress: string, timestamp: number): Promise<PriceData> {
        // Map ChainID to Coingecko Platform ID
        const platform = this.getCoingeckoPlatform(chainId);
        const date = new Date(timestamp * 1000);
        const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`; // DD-MM-YYYY

        let url;
        if (tokenAddress === 'native') {
            const nativeId = this.getCoingeckoNativeId(chainId);
            url = `${this.coingeckoUrl}/coins/${nativeId}/history?date=${dateStr}`;
        } else {
            url = `${this.coingeckoUrl}/coins/${platform}/contract/${tokenAddress}/history?date=${dateStr}`;
        }

        const response = await axios.get(url);
        const price = response.data.market_data?.current_price?.usd;

        if (!price) throw new Error('Price not found in Coingecko response');

        return {
            price,
            source: 'Coingecko',
            timestamp
        };
    }

    private getCoingeckoNativeId(chainId: number): string {
        switch (chainId) {
            case 137: return 'matic-network';
            case 56: return 'binancecoin';
            case 43114: return 'avalanche-2';
            // L2s that use ETH as native token
            case 1:
            case 8453: // Base
            case 10:   // Optimism
            case 42161: // Arbitrum One
            default: return 'ethereum';
        }
    }

    private async getDefiLlamaPrice(chainId: number, tokenAddress: string, timestamp: number): Promise<PriceData> {
        // DefiLlama historical: https://coins.llama.fi/prices/historical/{timestamp}/{chain}:{address}
        const chainPrefix = this.getDefiLlamaChain(chainId);
        // Special case for native
        const address = tokenAddress === 'native' ? '0x0000000000000000000000000000000000000000' : tokenAddress;

        const url = `https://coins.llama.fi/prices/historical/${timestamp}/${chainPrefix}:${address}`;
        const response = await axios.get(url);

        const key = `${chainPrefix}:${address}`;
        const price = response.data.coins[key]?.price;

        if (!price) throw new Error('Price not found in DeFiLlama response');

        return {
            price,
            source: 'DeFiLlama',
            timestamp
        };
    }

    private async getCoinCapPrice(tokenAddress: string): Promise<PriceData> {
        // CoinCap is limited for historical/tokens, using as rough fallback for current ETH
        const url = `${this.coincapUrl}/assets/ethereum`;
        const response = await axios.get(url);
        const price = parseFloat(response.data.data.priceUsd);

        return {
            price,
            source: 'CoinCap (Fallback)',
            timestamp: Math.floor(Date.now() / 1000)
        };
    }

    private getCoingeckoPlatform(chainId: number): string {
        switch (chainId) {
            case 1: return 'ethereum';
            case 8453: return 'base';
            case 137: return 'polygon-pos';
            case 10: return 'optimistic-ethereum';
            case 42161: return 'arbitrum-one';
            case 56: return 'binance-smart-chain';
            case 43114: return 'avalanche';
            default: return 'ethereum';
        }
    }

    private getDefiLlamaChain(chainId: number): string {
        switch (chainId) {
            case 1: return 'ethereum';
            case 8453: return 'base';
            case 137: return 'polygon';
            case 10: return 'optimism';
            case 42161: return 'arbitrum';
            case 56: return 'bsc';
            case 43114: return 'avax';
            default: return 'ethereum';
        }
    }

    private getWrappedNativeAddress(chainId: number): string | null {
        switch (chainId) {
            case 1: return '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
            case 8453: return '0x4200000000000000000000000000000000000006'; // WETH (Base)
            case 137: return '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // WMATIC
            case 10: return '0x4200000000000000000000000000000000000006'; // WETH (Optimism)
            case 42161: return '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'; // WETH (Arbitrum)
            default: return null;
        }
    }
}
