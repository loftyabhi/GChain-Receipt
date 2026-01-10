import { Metadata } from 'next';
import Link from 'next/link';

import { Navbar } from '@/components/Navbar';

import { constructCanonical, generateBreadcrumbSchema, generateFAQSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Transaction Intelligence',
    description: 'Enterprise-grade blockchain transaction intelligence. Privacy-first, deterministic analysis for compliance, accounting, and audit workflows.',
    alternates: {
        canonical: constructCanonical('/transaction-intelligence'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Transaction Intelligence', item: '/transaction-intelligence' },
];

const faqs = [
    { question: 'Can I use these reports for tax filing?', answer: 'These receipts serve as detailed transaction documentation (Section 404/compliance support) but do not replace professional tax advice or official exchange statements.' },
    { question: 'Is my wallet address stored?', answer: 'No. Chain Receipt performs analysis on-demand (client-side and state-less API) and does not maintain a database of user transaction histories or PII.' },
    { question: 'What happens if the API is down?', answer: 'Since our analysis is deterministic and based on public blockchain data, any transaction can be re-analyzed at any time to generate the exact same receipt, ensuring redundancy.' },
];

export default function TransactionIntelligence() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(faqs)) }}
            />
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-violet-900/20 to-transparent opacity-50" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10 pt-32 pb-20 px-6">

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

                <div className="max-w-3xl mx-auto mb-20">
                    <h2 className="text-3xl font-bold text-white mb-8 text-center">Common Questions</h2>
                    <div className="space-y-4">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-bold text-white mb-2">Can I use these reports for tax filing?</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                These receipts serve as detailed transaction documentation (Section 404/compliance support) but do not replace professional tax advice or official exchange statements.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-bold text-white mb-2">Is my wallet address stored?</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                No. Chain Receipt performs analysis on-demand (client-side and state-less API) and does not maintain a database of user transaction histories or PII.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                            <h3 className="font-bold text-white mb-2">What happens if the API is down?</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Since our analysis is deterministic and based on public blockchain data, any transaction can be re-analyzed at any time to generate the exact same receipt, ensuring redundancy.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Premium CTA Section */}
                <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-b from-zinc-900 to-black border border-white/10 text-center py-20 px-6">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20 pointer-events-none" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="text-3xl font-bold text-white mb-6">Ready for Audit-Grade Insights?</h2>
                        <p className="text-lg text-zinc-400 mb-10">
                            Join thousands of users relying on Chain Receipt for accurate, privacy-focused blockchain documentation.
                        </p>

                        <Link href="/" className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10 active:scale-95">
                            Start Analyzing
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
}
