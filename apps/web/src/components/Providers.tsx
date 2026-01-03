'use client'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, base, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

// Ensure project ID is available
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

if (!projectId) {
    console.warn('Missing NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID')
}

const config = createConfig({
    chains: [mainnet, base, sepolia],
    connectors: [
        injected(),
        metaMask(),
        walletConnect({ projectId: projectId || '' })
    ],
    transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [sepolia.id]: http()
    }
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                {children}
                <Toaster richColors position="bottom-right" theme="dark" />
            </QueryClientProvider>
        </WagmiProvider>
    )
}
