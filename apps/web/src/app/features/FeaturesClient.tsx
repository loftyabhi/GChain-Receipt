'use client';

import { Navbar } from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Zap, Shield, Globe, FileText, Code2, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function FeaturesClient() {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const features = [
        {
            icon: <Globe className="text-blue-400" size={32} />,
            title: "Multi-Chain Support",
            desc: "Generate receipts for transactions on Base, Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, and more.",
            color: "blue"
        },
        {
            icon: <FileText className="text-violet-400" size={32} />,
            title: "Instant PDF Generation",
            desc: "Turn complex transaction hashes into professional, audit-ready PDF receipts in seconds. Perfect for accounting.",
            color: "violet"
        },
        {
            icon: <Shield className="text-emerald-400" size={32} />,
            title: "Zero-Knowledge Privacy",
            desc: "Client-side processing architecture. Transaction data never leaves your browser session. Your financial sovereignty is absolute.",
            color: "emerald"
        },
        {
            icon: <CheckCircle2 className="text-orange-400" size={32} />,
            title: "Verifiable Data",
            desc: "All receipt data is fetched directly from the blockchain. No manual entry, no tampering, just truth.",
            color: "orange"
        },
        {
            icon: <Code2 className="text-pink-400" size={32} />,
            title: "Developer API",
            desc: "Native integration for wallets and dApps. Embed receipt generation directly into your user flows. (API Access Request required)",
            color: "pink"
        },
        {
            icon: <Users className="text-cyan-400" size={32} />,
            title: "Open Source",
            desc: "Trust through transparency. Our code is open source and community-driven. contribute on GitHub.",
            color: "cyan"
        }
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-violet-900/20 to-transparent opacity-50" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto">

                {/* Hero Section */}
                <div className="text-center mb-24 max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold tracking-wide uppercase mb-6 shadow-sm backdrop-blur-sm">
                            <Code2 size={14} />
                            Infrastructure Roadmap
                        </div>

                        <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 leading-[1.1] mb-8 tracking-tight">
                            Deterministic <br className="hidden md:block" /> Intelligence.
                        </h1>

                        <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
                            Chain Receipt provides deterministic, privacy-first blockchain documentation infrastructure. We transform raw on-chain data into audit-ready financial records without compromising user privacy or relying on centralized storage.
                        </p>
                    </motion.div>
                </div>

                {/* Features Grid - Refined */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32"
                >
                    {[
                        {
                            icon: <Globe className="text-blue-400" size={32} />,
                            title: "Multi-Chain Support",
                            desc: "Support for major EVM networks including Base, Ethereum, Polygon, and Arbitrum. Expansion is driven by user demand.",
                            color: "blue"
                        },
                        {
                            icon: <FileText className="text-violet-400" size={32} />,
                            title: "PDF Receipt Generation",
                            desc: "Automated generation of standardized PDF documentation from raw transaction hashes.",
                            color: "violet"
                        },
                        {
                            icon: <Shield className="text-emerald-400" size={32} />,
                            title: "Client-Side Processing",
                            desc: "Privacy-first architecture. Analysis primarily occurs within the client session, minimizing server-side data exposure.",
                            color: "emerald"
                        },
                        {
                            icon: <CheckCircle2 className="text-orange-400" size={32} />,
                            title: "Deterministic Output",
                            desc: "Reports are strictly derived from on-chain state. The same input hash will always produce the identical report.",
                            color: "orange"
                        },
                        {
                            icon: <Code2 className="text-pink-400" size={32} />,
                            title: "Developer API",
                            desc: "Programmatic access for high-volume receipt generation. (Currently in closed beta).",
                            color: "pink"
                        },
                        {
                            icon: <Users className="text-cyan-400" size={32} />,
                            title: "Open Source Core",
                            desc: "Core classification logic is verifiable and open for community audit on GitHub.",
                            color: "cyan"
                        }
                    ].map((feature, idx) => (
                        <motion.div
                            key={idx}
                            variants={item}
                            className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="mb-6 bg-black/20 w-16 h-16 rounded-2xl flex items-center justify-center border border-white/5">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                            <p className="text-zinc-400 leading-relaxed text-sm">
                                {feature.desc}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Roadmap Section */}
                <div className="max-w-5xl mx-auto mb-32">
                    <h2 className="text-3xl font-bold text-white mb-12 text-center">Execution Roadmap</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Phase 1 */}
                        <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full uppercase tracking-wide">
                                    Live
                                </span>
                                <span className="text-zinc-500 font-mono text-xs">Phase 1</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">Core Transaction Intelligence</h3>
                            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                                The foundation of Chain Receipt: deterministic, audit-oriented transaction interpretation built directly on public blockchain data.
                            </p>
                            <ul className="space-y-3">
                                {[
                                    "PDF Receipt Generation",
                                    "Semantic transaction classification",
                                    "Confidence scoring algorithm",
                                    "Privacy-first design (stateless)",
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Phase 2 */}
                        <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full uppercase tracking-wide">
                                    In Progress
                                </span>
                                <span className="text-zinc-500 font-mono text-xs">Phase 2</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">Reliability & Scale</h3>
                            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                                Preparing the platform for high-volume public usage through infrastructure hardening and performance optimization.
                            </p>
                            <ul className="space-y-3">
                                {[
                                    "Infrastructure hardening",
                                    "Caching & throughput improvements",
                                    "Multi-chain scale readiness",
                                    "Rate-limit protection",
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Phase 3 */}
                        <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 opacity-80 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold text-zinc-400 bg-zinc-500/10 border border-zinc-500/20 px-3 py-1 rounded-full uppercase tracking-wide">
                                    Planned
                                </span>
                                <span className="text-zinc-500 font-mono text-xs">Phase 3</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">Infrastructure Independence</h3>
                            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                                Reducing dependency on third-party platforms to support long-term stability and cost predictability.
                            </p>
                            <ul className="space-y-3">
                                {[
                                    "Migration from generic cloud hosting",
                                    "Hybrid infrastructure deployment",
                                    "Improved operational control",
                                    "Enterprise reliability guarantees",
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Phase 4 */}
                        <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 opacity-80 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold text-zinc-400 bg-zinc-500/10 border border-zinc-500/20 px-3 py-1 rounded-full uppercase tracking-wide">
                                    Planned
                                </span>
                                <span className="text-zinc-500 font-mono text-xs">Phase 4</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">Platform Expansion & Ecosystem</h3>
                            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                                A sustainable ecosystem around transaction intelligence, guided by real usage and community needs.
                            </p>
                            <ul className="space-y-3">
                                {[
                                    "Public APIs for intelligence",
                                    "Bulk / programmatic generation",
                                    "Organization & team workflows",
                                    "Feature prioritization governance",
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <p className="text-center text-xs text-zinc-600 mt-12 max-w-lg mx-auto">
                        Roadmap reflects current priorities and may evolve based on real-world usage.
                    </p>
                </div>

                {/* CTA Section */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-b from-zinc-900 to-black border border-white/10 text-center py-20 px-6"
                >
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-violet-500/10 blur-[100px] rounded-full" />

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="text-4xl font-bold text-white mb-6">Ready to streamline your crypto taxes?</h2>
                        <p className="text-lg text-zinc-400 mb-10">
                            Join thousands of users generating professional receipts for their on-chain transactions today.
                        </p>

                        <Link href="/" className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10 active:scale-95">
                            Start Generating Receipts
                            <ArrowRight size={20} />
                        </Link>
                    </div>
                </motion.div>

            </main>
        </div>
    );
}
