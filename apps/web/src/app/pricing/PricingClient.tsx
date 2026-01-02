'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X, CreditCard, Sparkles, Zap } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { motion } from 'framer-motion';

interface Plan {
    id: string;
    title: string;
    priceWei: string;
    validitySeconds: number;
    hasAds: boolean;
    canDownloadPdf: boolean;
}

export default function PricingClient() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('http://localhost:3001/api/v1/plans')
            .then(res => {
                setPlans(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

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

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30">
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
            </div>

            <main className="relative z-10 max-w-7xl mx-auto px-6 py-24">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-20"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-blue-300 mb-6">
                        <Sparkles size={14} className="text-blue-400" />
                        <span>Community Supported</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-6 tracking-tight">
                        Powering the Decentralized Web
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        Chain Receipt is free to use, supported by ethical advertising and community contributions.
                    </p>
                </motion.div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                ) : (
                    <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
                    >
                        {plans.length === 0 && (
                            <div className="col-span-3 text-center text-zinc-500 py-12 bg-white/5 rounded-3xl border border-white/5">
                                No plans active at the moment. Check back later!
                            </div>
                        )}

                        {plans.map((plan, index) => {
                            const isFree = plan.priceWei === '0';

                            return (
                                <motion.div
                                    key={plan.id}
                                    variants={item}
                                    className={`relative rounded-3xl p-8 flex flex-col transition-all duration-300 group
                                        ${index === 1
                                            ? 'bg-gradient-to-b from-violet-600/20 to-violet-900/10 border border-violet-500/30 md:-mt-8 md:mb-8'
                                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    {index === 1 && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-violet-600 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-600/40">
                                            Recommended
                                        </div>
                                    )}

                                    <div className="mb-8">
                                        <h3 className="text-xl font-bold text-white mb-2">{plan.title}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-extrabold text-white">
                                                {isFree ? 'Free' : `${(Number(plan.priceWei) / 1e18).toFixed(4)}`}
                                            </span>
                                            {!isFree && <span className="text-lg font-bold text-zinc-400">ETH</span>}
                                        </div>
                                        <div className="text-sm text-zinc-400 mt-2">
                                            per {plan.validitySeconds / 86400} days
                                        </div>
                                    </div>

                                    <ul className="space-y-4 mb-8 flex-grow">
                                        <li className="flex items-center gap-3">
                                            <div className={`p-1 rounded-full ${plan.canDownloadPdf ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {plan.canDownloadPdf ? <Check size={14} /> : <X size={14} />}
                                            </div>
                                            <span className="text-zinc-300">PDF Downloads</span>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <div className={`p-1 rounded-full ${!plan.hasAds ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {!plan.hasAds ? <Check size={14} /> : <X size={14} />}
                                            </div>
                                            <span className="text-zinc-300">Ad-Free Experience</span>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <div className="p-1 rounded-full bg-green-500/20 text-green-400">
                                                <Check size={14} />
                                            </div>
                                            <span className="text-zinc-300">24/7 Support</span>
                                        </li>
                                    </ul>

                                    <button className={`w-full py-3 px-6 rounded-xl font-semibold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2
                                        ${index === 1
                                            ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/20'
                                            : 'bg-white text-black hover:bg-zinc-200'
                                        }`}>
                                        {isFree ? 'Start Generating' : 'Support & Subscribe'}
                                        {!isFree && <Zap size={18} />}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </main>
        </div>
    );
}
