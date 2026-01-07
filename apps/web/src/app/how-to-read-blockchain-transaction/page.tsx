import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'How to Read a Blockchain Transaction | Chain Receipt',
    description: 'Learn how to interpret blockchain transaction hashes. Understand semantic classification, input data decoding, and confidence scoring for audit-grade reporting.',
};

export default function HowToReadTransaction() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-20 px-6 font-sans">
            <div className="max-w-3xl mx-auto relative z-10">
                <Link href="/" className="text-zinc-500 hover:text-white mb-8 inline-block transition-colors">← Back to Home</Link>

                <header className="mb-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6">
                        How to Read a <br />Blockchain Transaction
                    </h1>
                    <p className="text-xl text-zinc-400 leading-relaxed">
                        Raw blockchain data is often unintelligible. Learn how to transform hexadecimal hashes into human-readable, audit-grade intelligence.
                    </p>
                </header>

                <article className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-p:text-zinc-400 prose-strong:text-zinc-200 prose-a:text-violet-400">

                    <h2>The Problem with Raw Data</h2>
                    <p>
                        A standard block explorer shows you the <strong>interaction</strong> (Function Call: <code>0x123...</code>) but rarely the <strong>intent</strong>.
                        For accounting and compliance, knowing that <code>MethodID: 0xa9059cbb</code> was called is insufficient. You need to know that a <strong>Transfer</strong> of <strong>500 USDC</strong> occurred.
                    </p>

                    <div className="my-8 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                        <h3 className="text-yellow-200 mt-0">⚠️ Risk of Misinterpretation</h3>
                        <p className="mb-0 text-sm">
                            Simple decoders often fail on "Internal Transactions" or complex DeFi routing.
                            A single transaction hash might trigger 50+ internal transfers (e.g., an Aggregator Swap).
                            Reading only the top-level call will result in incorrect accounting.
                        </p>
                    </div>

                    <h2>Semantic Classification</h2>
                    <p>
                        <strong>Semantic Analysis</strong> is the process of mapping raw on-chain events to high-level financial concepts.
                        Chain Receipt uses a deterministic engine to classify transactions into categories like:
                    </p>
                    <ul>
                        <li><strong>Swap</strong>: Exchanging one asset for another.</li>
                        <li><strong>Bridge</strong>: Moving assets between chains.</li>
                        <li><strong>Diff</strong>: Complex state changes that don't fit simple models.</li>
                    </ul>

                    <h2>Confidence Scores Explained</h2>
                    <p>
                        Deterministic systems avoid guesswork. We assign a <strong>Confidence Score</strong> to every report:
                    </p>
                    <ul>
                        <li><strong>Confirmed</strong>: Matches a known, verified standard (e.g., ERC-20 Transfer).</li>
                        <li><strong>High</strong>: Matches a complex pattern with strong heuristics (e.g., Uniswap V3 Router).</li>
                        <li><strong>Likely</strong>: Matches generic patterns but lacks specific protocol verification.</li>
                    </ul>

                    <h2>Audit-Grade Documentation</h2>
                    <p>
                        For a transaction to be "Audit-Grade", it must be:
                    </p>
                    <ol>
                        <li><strong>Immutable</strong>: Based on finalized block data.</li>
                        <li><strong>Reproducible</strong>: The same input always generates the same report (Deterministic).</li>
                        <li><strong>Verifiable</strong>: Links back to the source chain state.</li>
                    </ol>

                    <div className="mt-12 not-prose">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-4 font-bold text-white transition-all hover:bg-violet-500 shadow-xl shadow-violet-600/20"
                        >
                            Analyze a Transaction Now
                        </Link>
                    </div>

                </article>
            </div>
        </div>
    );
}
