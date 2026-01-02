'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye } from 'lucide-react';

export default function PrivacyPolicyClient() {
    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-violet-500/30">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-4xl px-6 py-24">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
                        <Shield size={14} />
                        <span>Your Data is Safe</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
                    <p className="text-zinc-400">Last updated: {new Date().toLocaleDateString()}</p>
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
                                    <Eye className="w-5 h-5 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
                            </div>
                            <p className="pl-12 border-l border-white/5 ml-3">
                                Welcome to Chain Receipt. We respect your privacy and are committed to protecting your personal data.
                                This privacy policy will inform you as to how we look after your personal data when you visit our website
                                and tell you about your privacy rights and how the law protects you.
                            </p>
                        </section>

                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <Lock className="w-5 h-5 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">2. Data Processing & Collection</h2>
                            </div>
                            <div className="pl-12 border-l border-white/5 ml-3 space-y-4">
                                <p>
                                    Chain Receipt operates on a privacy-first, client-side architecture. We minimize data collection to the absolute necessity for service provision.
                                </p>
                                <ul className="grid gap-3 pt-2">
                                    {[
                                        "Public On-Chain Data: We fetch and display globally available blockchain transaction data.",
                                        "Voluntary Submissions: Email addresses or feedback you voluntarily provide for support.",
                                        "Usage Analytics: Anonymized technical data to improve platform performance (e.g., browser type).",
                                        "No Private Keys: We never have access to, nor will we ever ask for, your private keys or seed phrases."
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 shrink-0" />
                                            <span className="text-sm">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 pl-14">3. How We Use Your Data</h2>
                            <div className="pl-12 border-l border-white/5 ml-3">
                                <p className="mb-4">
                                    We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                                </p>
                                <ul className="space-y-2 list-disc list-inside text-zinc-400">
                                    <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                                    <li>Where it is necessary for our legitimate interests and your interests do not override those interests.</li>
                                    <li>Where we need to comply with a legal or regulatory obligation.</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 pl-14">4. Contact Us</h2>
                            <div className="pl-12 border-l border-white/5 ml-3">
                                <p>
                                    If you have any questions about this privacy policy or our privacy practices, please contact us at:
                                    <Link href="/contact-us" className="text-violet-400 hover:text-violet-300 ml-2 font-medium underline-offset-4 hover:underline transition-all">
                                        Contact Configuration
                                    </Link>
                                </p>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
