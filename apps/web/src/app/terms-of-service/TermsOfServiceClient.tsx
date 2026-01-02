'use client';

import { Navbar } from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Scale, Book, AlertCircle, FileCheck } from 'lucide-react';

export default function TermsOfServiceClient() {
    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-violet-500/30">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-4xl px-6 py-24">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/50 border border-zinc-700 text-zinc-300 text-xs font-medium mb-6">
                        <Scale size={14} />
                        <span>Legal Agreement</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
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
                                    <FileCheck className="w-5 h-5 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">1. Agreement to Terms</h2>
                            </div>
                            <p className="pl-12 border-l border-white/5 ml-3">
                                By accessing or using Chain Receipt, you agree to be bound by these Terms of Service and all applicable laws and regulations.
                                If you do not agree with any of these terms, you are prohibited from using or accessing this site.
                            </p>
                        </section>

                        <section>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <Book className="w-5 h-5 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">2. Use License</h2>
                            </div>
                            <div className="pl-12 border-l border-white/5 ml-3 space-y-4">
                                <p>
                                    Permission is granted to temporarily download one copy of the materials (information or software) on Chain Receipt's website for personal,
                                    non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                                </p>
                                <ul className="grid gap-2 pt-2 text-sm text-zinc-400">
                                    {[
                                        "Modify or copy the materials;",
                                        "Use the materials for any commercial purpose, or for any public display;",
                                        "Attempt to decompile or reverse engineer any software contained on Chain Receipt's website;",
                                        "Remove any copyright or other proprietary notations from the materials;",
                                        "Transfer the materials to another person or 'mirror' the materials on any other server."
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
                                    <AlertCircle className="w-5 h-5 text-amber-500/80" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">3. Disclaimer</h2>
                            </div>
                            <div className="pl-12 border-l border-white/5 ml-3">
                                <p>
                                    The materials on Chain Receipt's website are provided on an 'as is' basis. Chain Receipt makes no warranties, expressed or implied,
                                    and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability,
                                    fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                                </p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 pl-14">4. Limitations</h2>
                            <div className="pl-12 border-l border-white/5 ml-3">
                                <p>
                                    In no event shall Chain Receipt or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit,
                                    or due to business interruption) arising out of the use or inability to use the materials on Chain Receipt's website, even if Chain Receipt
                                    or a Chain Receipt authorized representative has been notified orally or in writing of the possibility of such damage.
                                </p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4 pl-14">5. Contributions & Support</h2>
                            <div className="pl-12 border-l border-white/5 ml-3">
                                <p>
                                    Any contributions, donations, or financial support provided to Chain Receipt are voluntary and non-refundable. Support fees do not grant equity, voting rights, or control over the project's direction. We reserve the right to modify or discontinue any aspect of the service at any time without liability.
                                </p>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
