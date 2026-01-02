'use client';

import React from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, base, sepolia, baseSepolia } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, type Config, http } from 'wagmi';
import { Toaster } from 'sonner';

// 1. Get projectId
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// 2. Set up Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks: [mainnet, base, sepolia, baseSepolia],
    transports: {
        [mainnet.id]: http(`https://rpc.walletconnect.com/v1?chainId=eip155:${mainnet.id}&projectId=${projectId}`),
        [base.id]: http(`https://rpc.walletconnect.com/v1?chainId=eip155:${base.id}&projectId=${projectId}`),
        [sepolia.id]: http(`https://rpc.walletconnect.com/v1?chainId=eip155:${sepolia.id}&projectId=${projectId}`),
        [baseSepolia.id]: http(`https://rpc.walletconnect.com/v1?chainId=eip155:${baseSepolia.id}&projectId=${projectId}`),
    }
});

// 3. Create modal
createAppKit({
    adapters: [wagmiAdapter],
    networks: [mainnet, base, sepolia, baseSepolia],
    projectId,
    metadata: {
        name: 'Chain Receipt',
        description: 'Blockchain Bill Generator',
        url: 'http://localhost:3000', // Update this to match your actual running origin
        icons: ['https://avatars.githubusercontent.com/u/179229932']
    },
    features: {
        analytics: true // Optional - defaults to your Cloud configuration
    }
});

// 4. Create QueryClient
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
            <QueryClientProvider client={queryClient}>
                {children}
                <Toaster richColors position="bottom-right" theme="dark" />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
