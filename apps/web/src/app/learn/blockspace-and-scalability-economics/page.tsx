import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { ArrowLeft, Box, Zap, Server, Layers, BarChart3, Lock, Scale, Network } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Blockspace & Scalability Economics',
    description: 'Understanding the scarce resource of blockspace, the economics of gas fees, and the necessity of Layer 2 scaling.',
    openGraph: {
        title: 'Blockspace Economics | Chain Receipt Learning',
        description: 'Why blockchains are slow by design, and how Rollups increase throughput without sacrificing decentralization.',
        type: 'article',
    },
};

export default function BlockspaceAndScalability() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: 'Blockspace & Scalability Economics',
        description: 'Technical analysis of blockchain resource constraints, gas markets, and scaling strategies.',
        author: {
            '@type': 'Organization',
            name: 'Chain Receipt',
        },
        educationalLevel: 'Expert',
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-violet-900/20 to-transparent opacity-50" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/5 blur-[120px]" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/5 blur-[120px]" />
            </div>

            <div className="max-w-4xl mx-auto pt-32 pb-20 px-6 relative z-10">
                <Link href="/learn" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors text-sm font-medium">
                    <ArrowLeft size={16} />
                    Back to Knowledge Base
                </Link>

                <article className="prose prose-invert prose-lg max-w-none">
                    <header className="mb-16">
                        <div className="flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-6">
                            <Box size={14} />
                            <span>Resource Economics</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 relative inline-block">
                            Blockspace Economics
                            <div className="absolute top-0 right-[-20%] hidden md:block w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        </h1>
                        <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl">
                            Blockspace is the most scarce digital resource. It is a finite container of computation, finalized every 12 seconds. The price of this space—Gas—is the heartbeat of the network's economy.
                        </p>
                    </header>

                    {/* The Gas Market */}
                    <section className="mb-20">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <Zap className="text-amber-400" size={24} />
                            The Gas Auction (EIP-1559)
                        </h2>
                        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 mb-8">
                            <p className="text-zinc-300 mb-8">
                                Before 2021, fees were a blind auction. EIP-1559 introduced an algorithmic pricing model to make fees predictable and efficient.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <h4 className="font-bold text-violet-400 mb-2">1. Base Fee (Burned)</h4>
                                    <p className="text-sm text-zinc-400 mb-4">
                                        The mandatory price to enter the block. It is set by the protocol based on demand.
                                    </p>
                                    <ul className="text-xs text-zinc-500 space-y-2">
                                        <li className="flex gap-2"><span>•</span> If block is {'>'} 50% full, fees go UP.</li>
                                        <li className="flex gap-2"><span>•</span> If block is {'<'} 50% full, fees go DOWN.</li>
                                        <li className="flex gap-2 text-red-400/80"><span>•</span> This ETH is destroyed (deflationary).</li>
                                    </ul>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-[-24px] top-0 bottom-0 w-px bg-white/10 hidden md:block"></div>
                                    <h4 className="font-bold text-green-400 mb-2">2. Priority Fee (Tip)</h4>
                                    <p className="text-sm text-zinc-400 mb-4">
                                        An optional "bribe" to the validator to order your transaction before others.
                                    </p>
                                    <ul className="text-xs text-zinc-500 space-y-2">
                                        <li className="flex gap-2"><span>•</span> Critical for time-sensitive trades.</li>
                                        <li className="flex gap-2"><span>•</span> Goes directly to the validator.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* The Node Constraint */}
                    <section className="mb-20">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <Server className="text-blue-400" size={24} />
                            Why not just increase block size?
                        </h2>
                        <div className="p-8 border border-blue-500/20 bg-blue-500/5 rounded-2xl">
                            <h3 className="font-bold text-blue-200 mb-4">The Centralization Risk</h3>
                            <p className="text-zinc-300 mb-4">
                                It is trivial to increase throughput by making blocks 100x larger (like Solana or BSC). However, this increases the <strong>hardware requirement</strong> to run a node.
                            </p>
                            <p className="text-zinc-300">
                                If trusting the chain requires a $5,000 server and a fiber connection, everyday users cannot verify the ledger. They must trust intermediaries (Infura, Alchemy, Binance).
                                <br /><br />
                                <strong>The Golden Rule:</strong> A consumer laptop must be able to verify the chain. If users cannot verify, miners can change the rules (e.g., print more money), and no one would know.
                            </p>
                        </div>
                    </section>

                    {/* The Scaling Solution */}
                    <section className="mb-20">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <Layers className="text-violet-400" size={24} />
                            The Modular Scaling Vision
                        </h2>
                        <p className="text-zinc-300 mb-8">
                            Since L1 blockspace must remain expensive (to keep nodes light), we scale by moving execution elsewhere.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* L1 */}
                            <div className="p-6 bg-zinc-900/50 border border-white/10 rounded-2xl">
                                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <Lock className="text-zinc-400" size={18} />
                                    Layer 1 (Ethereum)
                                </h3>
                                <p className="text-zinc-400 text-sm mb-4">
                                    <strong>The Settlement Layer.</strong> Optimized for security/verification, not speed.
                                </p>
                                <div className="p-3 bg-black/40 rounded text-xs font-mono text-zinc-500">
                                    Role: Data Availability & Dispute Resolution
                                </div>
                            </div>

                            {/* L2 */}
                            <div className="p-6 bg-zinc-900/50 border border-white/10 rounded-2xl">
                                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <Zap className="text-violet-400" size={18} />
                                    Layer 2 (Rollups)
                                </h3>
                                <p className="text-zinc-400 text-sm mb-4">
                                    <strong>The Execution Layer.</strong> Optimized for speed. Executes thousands of transactions, compresses them, and posts a single "proof" to L1.
                                </p>
                                <div className="p-3 bg-black/40 rounded text-xs font-mono text-zinc-500">
                                    Role: Throughput & User Interaction
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section className="mb-20">
                        <h2 className="text-3xl font-bold text-white mb-8">Frequently Asked Questions</h2>
                        <div className="space-y-4">
                            <details className="group border border-white/10 rounded-2xl bg-white/5 p-6 open:bg-white/10 transition-colors">
                                <summary className="flex cursor-pointer items-center justify-between font-bold text-white group-hover:text-violet-400 select-none">
                                    Why do gas fees spike so high?
                                    <span className="text-zinc-500 group-hover:text-violet-400 transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <p className="mt-4 text-zinc-400 leading-relaxed">
                                    Supply is perfectly inelastic (blocks happen every 12s regardless of demand). Demand is highly elastic. If 10,000 people want to mint an NFT in the same block, the protocol exponentially raises the Base Fee until 9,900 of them give up. It is strict pricing out of demand.
                                </p>
                            </details>
                            <details className="group border border-white/10 rounded-2xl bg-white/5 p-6 open:bg-white/10 transition-colors">
                                <summary className="flex cursor-pointer items-center justify-between font-bold text-white group-hover:text-violet-400 select-none">
                                    Will Sharding lower gas fees?
                                    <span className="text-zinc-500 group-hover:text-violet-400 transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <p className="mt-4 text-zinc-400 leading-relaxed">
                                    Directly? No. Sharding (Danksharding) lowers the cost for <strong>Rollups</strong> to post data to Ethereum. This makes L2s much cheaper (sub-cent fees), but L1 transactions will likely remain expensive premium real estate.
                                </p>
                            </details>
                            <details className="group border border-white/10 rounded-2xl bg-white/5 p-6 open:bg-white/10 transition-colors">
                                <summary className="flex cursor-pointer items-center justify-between font-bold text-white group-hover:text-violet-400 select-none">
                                    What is "Blob" space?
                                    <span className="text-zinc-500 group-hover:text-violet-400 transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <p className="mt-4 text-zinc-400 leading-relaxed">
                                    Introduced in EIP-4844 (Proto-Danksharding), Blobs are a new type of temporary data storage attached to blocks. They are specifically designed for Rollups to store their transaction data cheaply, separate from the expensive permanent execution storage.
                                </p>
                            </details>
                        </div>
                    </section>
                </article>
            </div>
        </div>
    );
}
