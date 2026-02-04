'use client';

import { Navbar } from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Scale, Book, AlertCircle, FileCheck, Shield } from 'lucide-react';

export default function TermsOfServiceClient() {
    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-violet-500/30">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-24">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12 border-b border-white/10 pb-8 text-center md:text-left"
                >
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
                    <p className="text-lg text-zinc-400">
                        Last Updated: February 04, 2026
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="rounded-3xl bg-zinc-900/50 border border-white/10 p-8 md:p-12 backdrop-blur-xl"
                >
                    <div className="space-y-12 text-zinc-300 leading-relaxed">

                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <FileCheck className="w-5 h-5 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">1. Agreement to Terms</h2>
                            </div>
                            <p className="pl-12 border-l border-white/5 ml-3">
                                By accessing or using TxProof, you agree to be bound by these Terms of Service and all applicable laws and regulations.
                                If you do not agree with any of these terms, you are prohibited from using or accessing this site.
                            </p>
                        </section>

                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <Book className="w-5 h-5 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">2. Usage & Fair Use Policy</h2>
                            </div>
                            <div className="pl-12 border-l border-white/5 ml-3 space-y-4">
                                <p>
                                    TxProof provides tools for generating verifiable transaction receipts. Your usage of our API and platform is subject to the following conditions:
                                </p>
                                <ul className="grid gap-2 pt-2 text-sm text-zinc-400">
                                    {[
                                        "You may not use the platform for any illegal or fraudulent activities.",
                                        "You may not attempt to reverse engineer the receipt generation logic or cryptographic signing processes.",
                                        "You may not bypass API rate limits or quota enforcement mechanisms.",
                                        "Duplicate email verification attempts across multiple wallets for the purpose of quota stacking are strictly prohibited.",
                                        "Automated harvesting of receipts or bulk generation that strains system resources may result in immediate suspension."
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <Shield className="w-5 h-5 text-red-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">3. API Quotas & Account Status</h2>
                            </div>
                            <div className="pl-12 border-l border-white/5 ml-3 space-y-4">
                                <p>
                                    Usage is governed by a meritocratic quota system. Each account is assigned a strictly enforced monthly request limit.
                                </p>
                                <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-400">
                                    <li><strong>Quota Enforcement:</strong> Once your monthly limit is reached, service will be restricted until the next billing cycle or an override is granted.</li>
                                    <li><strong>Account Banning:</strong> We reserve the absolute right to ban wallets and associated email addresses from the platform if we detect malicious intent, sybil attacks, or repeated terms violations.</li>
                                    <li><strong>Verification:</strong> To access higher limits, users may be required to verify their email. A verified email can only be linked to a single wallet address.</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <AlertCircle className="w-5 h-5 text-amber-500/80" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">4. Disclaimer</h2>
                            </div>
                            <div className="pl-12 border-l border-white/5 ml-3">
                                <p>
                                    Receipts generated by TxProof are deterministic and based on public blockchain data. While we strive for 100% cryptographic accuracy, materials are provided on an 'as is' basis. TxProof makes no warranties, expressed or implied, regarding the external legal acceptance of these receipts in any specific jurisdiction.
                                </p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 pl-14">5. Contributions & Support</h2>
                            <div className="pl-12 border-l border-white/5 ml-3">
                                <p>
                                    Any contributions or donations provided to TxProof are voluntary and non-refundable. Support fees do not grant equity or voting rights. We reserve the right to modify or discontinue any aspect of the service at any time.
                                </p>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
