'use client';

import ContactForm from '@/components/ContactForm';
import { Navbar } from '@/components/Navbar';
import { Mail, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ContactUsClient() {
    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-violet-500/30">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-24">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium">
                            <MessageSquare size={14} />
                            <span>Compliance & Support</span>
                        </div>

                        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight">
                            Get in touch with <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-500">Our Team</span>
                        </h1>

                        <p className="text-lg text-zinc-400 leading-relaxed max-w-lg">
                            For compliance inquiries, technical support, or partnership opportunities.
                            Our team is ready to assist with your blockchain intelligence needs.
                        </p>

                        <div className="pt-8 border-t border-white/5">
                            <div className="flex items-center gap-5 group">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-violet-400 group-hover:scale-110 group-hover:bg-violet-500/10 transition-all duration-300">
                                    <Mail size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-500 mb-1">Email us at</p>
                                    <p className="font-semibold text-white text-lg tracking-wide hover:text-violet-400 transition-colors cursor-pointer">
                                        sarkaritoolmail@gmail.com
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <ContactForm />
                    </motion.div>

                </div>
            </div>
        </main>
    );
}
