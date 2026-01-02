'use client';

import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { FileText, Receipt, ShieldCheck, Zap, Github, Twitter, Linkedin } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AboutUsClient() {
    const fadeIn = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 }
    };

    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden selection:bg-violet-500/30">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-24">

                {/* Header Section */}
                <motion.div
                    initial={fadeIn.initial}
                    animate={fadeIn.animate}
                    transition={fadeIn.transition}
                    className="text-center mb-20 max-w-3xl mx-auto"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-violet-300 mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                        </span>
                        Building the Future of Web3 Compliance
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-6 tracking-tight">
                        About Chain Receipt
                    </h1>
                    <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
                        Bridging the gap between decentralized ledgers and enterprise accounting.
                        We provide the documentation layer for the blockchain economy.
                    </p>
                </motion.div>

                {/* Mission & Vision */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="group relative overflow-hidden rounded-3xl bg-zinc-900/50 border border-white/10 p-8 hover:bg-zinc-900/80 transition-all duration-300"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-6">
                                <Zap className="w-6 h-6 text-violet-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
                            <p className="text-zinc-400 leading-relaxed">
                                To standardize blockchain record-keeping. We aim to ease the burden of compliance for retail users and businesses alike by providing audit-grade documentation for every on-chain event.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="group relative overflow-hidden rounded-3xl bg-zinc-900/50 border border-white/10 p-8 hover:bg-zinc-900/80 transition-all duration-300"
                    >
                        <div className="absolute inset-0 bg-gradient-to-bl from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
                                <ShieldCheck className="w-6 h-6 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-4">Our Vision</h2>
                            <p className="text-zinc-400 leading-relaxed">
                                We envision a future where every blockchain transaction comes with a verifiable proof of payment, seamlessly integrating decentralized finance with traditional accounting systems.
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* What We Offer Section */}
                <div className="mb-24">
                    <motion.h2
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-3xl font-bold text-white mb-12 text-center"
                    >
                        What We Offer
                    </motion.h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Receipt, title: "Instant Receipts", desc: "Generate PDF receipts for any transaction hash instantly.", color: "text-violet-400", bg: "bg-violet-500/10" },
                            { icon: FileText, title: "Detailed History", desc: "Track your entire transaction history with ease.", color: "text-pink-400", bg: "bg-pink-500/10" },
                            { icon: ShieldCheck, title: "Verifiable Data", desc: "All data is fetched directly from the blockchain for 100% accuracy.", color: "text-blue-400", bg: "bg-blue-500/10" },
                            { icon: Zap, title: "Multi-Chain Support", desc: "Support for Ethereum, Polygon, BSC, and more.", color: "text-amber-400", bg: "bg-amber-500/10" }
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-violet-500/30 hover:bg-white/10 transition-all duration-300"
                            >
                                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <item.icon className={`w-6 h-6 ${item.color}`} />
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Meet the Developer Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-3xl mx-auto w-full"
                >
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 to-black border border-white/10 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-transparent to-blue-600/20 opacity-50" />

                        <div className="relative bg-black/40 backdrop-blur-xl rounded-[22px] p-8 md:p-12 text-center">
                            <h2 className="text-3xl font-bold text-white mb-6">Meet the Developer</h2>

                            <div className="mb-8">
                                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-blue-600 p-[2px] mb-6">
                                    <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-2xl font-bold text-white">
                                        LA
                                    </div>
                                </div>
                                <p className="text-zinc-300 text-lg mb-4">
                                    Chain Receipt is built and maintained by <span className="text-white font-semibold">loftyabhi</span>.
                                </p>
                                <p className="text-zinc-500 max-w-lg mx-auto">
                                    A dedicated developer focused on building essential, privacy-preserving Web3 infrastructure.
                                </p>
                            </div>

                            {/* Social Links */}
                            <div className="flex flex-wrap justify-center gap-4">
                                {[
                                    { icon: Github, label: "Github", href: "https://github.com/loftyabhi" },
                                    { icon: Twitter, label: "X (Twitter)", href: "https://twitter.com/loftyabhi" },
                                    { icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com/in/loftyabhi" }
                                ].map((social, i) => (
                                    <Link
                                        key={i}
                                        href={social.href}
                                        target="_blank"
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300 group"
                                    >
                                        <social.icon size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                                        <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{social.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

            </div>
        </main>
    );
}
