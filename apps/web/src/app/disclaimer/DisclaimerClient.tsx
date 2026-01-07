'use client';

import { Navbar } from '@/components/Navbar';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Scale, Info } from 'lucide-react';

export default function DisclaimerClient() {
    const fadeIn = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 }
    };

    const sections = [
        {
            title: "Not Financial or Legal Advice",
            icon: <Scale className="text-violet-400" size={24} />,
            content: "The intelligence and documentation provided by Chain Receipt are for informational and record-keeping purposes only. No content herein constitutes financial, investment, legal, or tax advisory services. Users are responsible for their own compliance obligations."
        },
        {
            title: "No Warranties",
            icon: <ShieldAlert className="text-blue-400" size={24} />,
            content: "Chain Receipt is an experimental technology suite provided 'as is' and 'as available'. We explicitly disclaim all representations and warranties, including implying warranties of merchantability, fitness for a particular purpose, and non-infringement. Code and smart contract interactions are at your own risk."
        },
        {
            title: "Blockchain Data",
            icon: <Info className="text-emerald-400" size={24} />,
            content: "Chain Receipt relies on public blockchain data and third-party APIs to generate receipts. While we strive for accuracy, we cannot guarantee the completeness or correctness of the data fetched from these external sources. Always verify transaction details on a block explorer. Generated reports are interpretive summaries, not authoritative blockchain records."
        },
        {
            title: "Limitation of Liability",
            icon: <AlertTriangle className="text-orange-400" size={24} />,
            content: "In no event shall Chain Receipt, its developers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service."
        }
    ];

    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-24">

                {/* Header */}
                <motion.div
                    initial={fadeIn.initial}
                    animate={fadeIn.animate}
                    transition={fadeIn.transition}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold tracking-wide uppercase mb-6 backdrop-blur-sm">
                        <AlertTriangle size={14} />
                        Important Notice
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 tracking-tight">
                        Disclaimer
                    </h1>
                    <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        Please read this disclaimer carefully before using our service.
                    </p>
                </motion.div>

                {/* Content Cards */}
                <div className="grid gap-6">
                    {sections.map((section, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.5 }}
                            className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-2xl bg-black/40 border border-white/5 shrink-0">
                                    {section.icon}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-3">{section.title}</h2>
                                    <p className="text-zinc-400 leading-relaxed text-sm md:text-base">
                                        {section.content}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-16 pt-8 border-t border-white/10 text-center"
                >
                    <p className="text-sm text-zinc-500">
                        Last updated: January 2026
                    </p>
                </motion.div>

            </div>
        </main>
    );
}
