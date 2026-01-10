import { Metadata } from 'next';
import Link from 'next/link';

import { Navbar } from '@/components/Navbar';

import { constructCanonical, generateBreadcrumbSchema, generateArticleSchema, generateFAQSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'How to Read a Blockchain Transaction',
    description: 'Learn how to interpret blockchain transaction hashes. Understand semantic classification, input data decoding, and confidence scoring for audit-grade reporting.',
    alternates: {
        canonical: constructCanonical('/how-to-read-blockchain-transaction'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'How to Read Transactions', item: '/how-to-read-blockchain-transaction' },
];

const faqs = [
    { question: "Why doesn't the hash show everything?", answer: "A hash only identifies the event location. Depending on smart contract logic, a single hash can trigger dozens of internal transfers not visible in top-level input data." },
    { question: "How is the Confidence Score calculated?", answer: "It is determined deterministically by comparing event logs against known ABI standards versus generic heuristic patterns." },
    { question: "Is this legally binding?", answer: "No. These are interpretive summaries of public data for compliance workflows, not a substitute for legal counsel." }
];

export default function HowToReadTransaction() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(generateArticleSchema(
                        'How to Read a Blockchain Transaction',
                        'Learn how to transform hexadecimal hashes into human-readable, audit-grade intelligence.',
                        '2024-01-01', // Static date for now, or dynamic if preferred
                        '2024-01-01',
                        '/og-how-to.png', // Placeholder, or real image path
                        'Educational'
                    ))
                }}
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

                <header className="mb-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 relative">
                        How to Read a <br />Blockchain Transaction
                        <div className="absolute top-0 right-0 hidden md:block w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    </h1>
                    <p className="text-xl text-zinc-400 leading-relaxed max-w-3xl">
                        Raw blockchain data is often unintelligible. Learn how to transform hexadecimal hashes into human-readable, audit-grade intelligence.
                    </p>
                </header>

                <div className="space-y-24">

                    {/* Problem Section */}
                    <section>
                        <h2 className="text-3xl font-bold text-white mb-6">The Problem with Raw Data</h2>
                        <div className="prose prose-invert max-w-none text-zinc-400 text-lg leading-relaxed">
                            <p>
                                A standard block explorer shows you the <span className="text-white font-medium">interaction</span> (e.g., Function Call: <code>0x123...</code>) but rarely the <span className="text-white font-medium">intent</span>.
                                For accounting and compliance, knowing that <code>MethodID: 0xa9059cbb</code> was called is insufficient. You need to know that a <span className="text-white font-bold">Transfer</span> of <span className="text-white font-bold">500 USDC</span> occurred.
                            </p>
                        </div>

                        <div className="mt-8 p-8 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl flex gap-4 items-start">
                            <div className="text-2xl pt-1">⚠️</div>
                            <div>
                                <h3 className="text-yellow-200 font-bold mb-2">Risk of Misinterpretation</h3>
                                <p className="text-zinc-400 leading-relaxed">
                                    Simple decoders often fail on "Internal Transactions" or complex DeFi routing.
                                    A single transaction hash might trigger 50+ internal transfers (e.g., an Aggregator Swap).
                                    Reading only the top-level call will result in incorrect accounting.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Classification & Confidence Grid */}
                    <section className="grid md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm">01</span>
                                Semantic Classification
                            </h2>
                            <p className="text-zinc-400 mb-6 min-h-[50px]">
                                Mapping raw on-chain events to high-level financial concepts using our deterministic engine.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex gap-3 text-zinc-300">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                    <span><strong>Swap</strong>: Exchanging tokens.</span>
                                </li>
                                <li className="flex gap-3 text-zinc-300">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                    <span><strong>Bridge</strong>: Cross-chain moves.</span>
                                </li>
                                <li className="flex gap-3 text-zinc-300">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                    <span><strong>Diff</strong>: Complex state changes.</span>
                                </li>
                            </ul>
                        </div>

                        <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/10">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm">02</span>
                                Confidence Scores
                            </h2>
                            <p className="text-zinc-400 mb-6 min-h-[50px]">
                                We assign a confidence score to every report to indicate certainty level.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex gap-3 text-zinc-300">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <span><strong>Confirmed</strong>: Verified Standard.</span>
                                </li>
                                <li className="flex gap-3 text-zinc-300">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <span><strong>High</strong>: Strong Heuristics.</span>
                                </li>
                                <li className="flex gap-3 text-zinc-300">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <span><strong>Likely</strong>: Generic Pattern.</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Audit Criteria */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-8">What makes it "Audit-Grade"?</h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                { title: "Immutable", desc: "Based strictly on finalized block data." },
                                { title: "Reproducible", desc: "Deterministic logic ensures identical outputs." },
                                { title: "Verifiable", desc: "Every data point links back to chain state." }
                            ].map((item, i) => (
                                <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                                    <p className="text-zinc-400 text-sm">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* FAQ */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>
                        <div className="grid gap-4">
                            {[
                                { q: "Why doesn't the hash show everything?", a: "A hash only identifies the event location. Depending on smart contract logic, a single hash can trigger dozens of internal transfers not visible in top-level input data." },
                                { q: "How is the Confidence Score calculated?", a: "It is determined deterministically by comparing event logs against known ABI standards versus generic heuristic patterns." },
                                { q: "Is this legally binding?", a: "No. These are interpretive summaries of public data for compliance workflows, not a substitute for legal counsel." }
                            ].map((faq, i) => (
                                <details key={i} className="group border border-white/10 rounded-2xl bg-white/5 p-6 open:bg-white/10 transition-colors">
                                    <summary className="flex cursor-pointer items-center justify-between font-bold text-white group-hover:text-violet-400 select-none">
                                        {faq.q}
                                    </summary>
                                    <p className="mt-4 text-zinc-400 leading-relaxed">
                                        {faq.a}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </section>

                    {/* Premium CTA Section */}
                    <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-b from-zinc-900 to-black border border-white/10 text-center py-20 px-6 mt-24">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20 pointer-events-none" />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />

                        <div className="relative z-10 max-w-2xl mx-auto">
                            <h2 className="text-3xl font-bold text-white mb-6">Ready to Interpret the Blockchain?</h2>
                            <p className="text-lg text-zinc-400 mb-10">
                                Apply this knowledge instantly. Enter any transaction hash to see semantic analysis in action.
                            </p>

                            <Link href="/" className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10 active:scale-95">
                                Analyze a Transaction Now
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
