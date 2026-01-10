import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { BookOpen, Database, EthernetPort, FileText, Layers, ShieldCheck, Network, Gavel, Zap, Box, Hammer, Coins, Scale } from 'lucide-react';

import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Learn Blockchain Fundamentals',
    description: 'A neutral, technical reference for understanding blockchain, EVM, and transaction mechanics. No hype, just documentation.',
    alternates: {
        canonical: constructCanonical('/learn'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Learn', item: '/learn' },
];

const topics = [
    {
        title: 'What is Blockchain?',
        slug: 'what-is-blockchain',
        description: 'Understand the fundamental structure of distributed ledgers and state machines.',
        icon: Database,
    },
    {
        title: 'How Transactions Work',
        slug: 'how-transactions-work',
        description: 'Deep dive into state transitions, signing, mempools, and block inclusion.',
        icon: FileText,
    },
    {
        title: 'Ethereum & EVM',
        slug: 'ethereum-and-evm',
        description: 'The architecture of the Ethereum Virtual Machine and how it executes code.',
        icon: EthernetPort,
    },
    {
        title: 'Smart Contracts',
        slug: 'what-is-a-smart-contract',
        description: 'Beyond the buzzword: deterministic programs running on a decentralized computer.',
        icon: FileText,
    },
    {
        title: 'DeFi Explained',
        slug: 'defi-explained',
        description: 'The mechanics of decentralized finance: AMMs, lending pools, and flash loans.',
        icon: Layers,
    },
    {
        title: 'NFTs: A Technical View',
        slug: 'nfts-explained',
        description: 'Understanding ERC-721 and ERC-1155 standards beyond digital art.',
        icon: ShieldCheck,
    },
    {
        title: 'Bridges & L2s',
        slug: 'bridges-rollups-l2',
        description: 'Scaling solutions: Optimistic rollups, ZK-rollups, and cross-chain messaging.',
        icon: Layers,
    },
    {
        title: 'State & Data Structures',
        slug: 'state-and-data-structures',
        description: 'Merkle Patricia Tries, World State, and trustless light client verification.',
        icon: Network,
    },
    {
        title: 'DAO & Governance',
        slug: 'dao-and-governance',
        description: 'On-chain voting systems, proposal lifecycles, and governance attack vectors.',
        icon: Gavel,
    },
    {
        title: 'MEV & Ordering',
        slug: 'mev-and-transaction-ordering',
        description: 'The Dark Forest: Sandwich attacks, front-running, and the MEV supply chain.',
        icon: Zap,
    },
    {
        title: 'On-Chain vs Off-Chain',
        slug: 'onchain-vs-offchain',
        description: 'Hybrid architectures, Oracles, and the boundary between code and the real world.',
        icon: Box,
    },
    {
        title: 'Consensus Mechanisms',
        slug: 'consensus-mechanisms',
        description: 'PoW vs PoS: Sybil resistance, fork choice rules, and slashing mechanics.',
        icon: Hammer,
    },
    {
        title: 'Stablecoins & Design',
        slug: 'stablecoins-and-monetary-design',
        description: 'Fiat-backed vs Algo, peg mechanics, and the trilemma of digital money.',
        icon: Scale,
    },
    {
        title: 'Blockspace Economics',
        slug: 'blockspace-and-scalability-economics',
        description: 'Gas markets (EIP-1559), congestion, and why scaling requires Layer 2s.',
        icon: Layers,
    },
    {
        title: 'Common Terms',
        slug: 'common-crypto-terms',
        description: 'A glossary of essential technical definitions without marketing fluff.',
        icon: BookOpen,
    },
];

export default function LearnHub() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-violet-900/20 to-transparent opacity-50" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10 pt-32 pb-20 px-6">
                <header className="mb-20 text-center max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-white/10 text-zinc-400 text-xs font-bold tracking-wide uppercase mb-6 backdrop-blur-sm">
                        Documentation
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 tracking-tight relative inline-block">
                        Professional <br /> Blockchain Intelligence
                        <div className="absolute top-0 right-[-20%] hidden md:block w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    </h1>
                    <p className="text-xl text-zinc-400 leading-relaxed">
                        A strictly neutral, technical reference for understanding how decentralized systems actually work.
                        Written for auditors, developers, and compliance professionals.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topics.map((topic) => (
                        <Link
                            key={topic.slug}
                            href={`/learn/${topic.slug}`}
                            className="group p-8 rounded-3xl bg-zinc-900/50 border border-white/10 hover:border-violet-500/30 hover:bg-zinc-800/50 transition-all duration-300 backdrop-blur-sm"
                        >
                            <div className="mb-6 w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform shadow-inner shadow-white/5">
                                <topic.icon className="text-zinc-400 group-hover:text-white transition-colors" size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-3 group-hover:text-violet-200 transition-colors">
                                {topic.title}
                            </h2>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                {topic.description}
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
