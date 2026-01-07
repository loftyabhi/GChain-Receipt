import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Transaction Intelligence | Chain Receipt',
    description: 'Enterprise-grade blockchain transaction intelligence. Privacy-first, deterministic analysis for compliance, accounting, and audit workflows.',
};

export default function TransactionIntelligence() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-20 px-6 font-sans">
            <div className="max-w-5xl mx-auto relative z-10">
                <Link href="/" className="text-zinc-500 hover:text-white mb-8 inline-block transition-colors">← Back to Home</Link>

                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 tracking-tight">
                        Transaction Intelligence
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                        The standard for interpreting on-chain value flow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                    <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-violet-500/50 transition-colors">
                        <h3 className="text-2xl font-bold text-white mb-4">Semantic</h3>
                        <p className="text-zinc-400">
                            We move beyond raw hex data. Our engine decodes the <i>intent</i> of every transaction, whether it's a simple transfer or a complex multi-hop swap.
                        </p>
                    </div>
                    <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-violet-500/50 transition-colors">
                        <h3 className="text-2xl font-bold text-white mb-4">Deterministic</h3>
                        <p className="text-zinc-400">
                            Zero hallucinations. Our output is strictly derived from on-chain state, ensuring that your reports are reproducible and audit-ready every time.
                        </p>
                    </div>
                    <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-violet-500/50 transition-colors">
                        <h3 className="text-2xl font-bold text-white mb-4">Privacy-First</h3>
                        <p className="text-zinc-400">
                            Your financial data is yours. We perform analysis on-demand without storing your transaction history or wallet addresses.
                        </p>
                    </div>
                </div>

                <div className="bg-[#0F0F11] rounded-3xl p-12 text-center border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>

                    <h2 className="text-3xl font-bold text-white mb-6 relative z-10">Ready for Audit-Grade Insights?</h2>
                    <p className="text-zinc-400 mb-8 max-w-2xl mx-auto relative z-10">
                        Join thousands of users relying on Chain Receipt for accurate, privacy-focused blockchain documentation.
                    </p>
                    <Link
                        href="/"
                        className="relative z-10 inline-flex items-center gap-2 rounded-xl bg-white text-black px-8 py-4 font-bold transition-transform hover:scale-105"
                    >
                        Start Analyzing
                    </Link>
                </div>

            </div>
        </div>
    );
}
