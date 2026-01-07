import { Metadata } from 'next';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import Script from 'next/script';
import Link from 'next/link';

type Props = {
    params: Promise<{
        chain: string;
        txHash: string;
    }>
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { chain, txHash } = await params;
    const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);

    return {
        title: `Blockchain Transaction Analysis – ${chainName} Network`,
        description: `Human-readable analysis of an on-chain transaction using deterministic classification. Audit-grade, privacy-first interpretation.`,
        robots: {
            index: false,
            follow: true,
        },
        alternates: {
            canonical: `https://chainreceipt.com/tx/${chain}/${txHash}`,
        },
        openGraph: {
            title: `${chainName} Transaction Analysis`,
            description: `View semantic analysis and download receipt for this transaction.`,
        },
    };
}

export default async function TransactionPage({ params }: Props) {
    const { chain, txHash } = await params;
    const chainName = chain.charAt(0).toUpperCase() + chain.slice(1);

    // Structured Data for SoftwareApplication/TechArticle
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: `Blockchain Transaction Analysis: ${txHash}`,
        description: `Semantic interpretation and audit-grade documentation for ${chainName} transaction ${txHash}.`,
        articleSection: 'Blockchain Analysis',
        author: {
            '@type': 'Organization',
            name: 'Chain Receipt',
        },
        about: {
            '@type': 'Thing',
            name: 'Blockchain Transaction',
            description: `Transaction hash ${txHash} on the ${chainName} network.`,
        },
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-20 px-6 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Background Gradients (Similar to Home) */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] opacity-20" />
                </div>

                <nav className="mb-8 z-10 relative">
                    <Link href="/" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2">
                        ← Back to Home
                    </Link>
                </nav>

                <header className="mb-12 z-10 relative">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-400 uppercase mb-4 tracking-wide border border-violet-500/20">
                        Audit-Grade Analysis
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 break-all">
                        Transaction<br />
                        <span className="text-2xl md:text-4xl text-zinc-500 block mt-2 font-mono">{txHash}</span>
                    </h1>
                    <p className="text-lg text-zinc-400 max-w-2xl">
                        You are viewing the semantic analysis for a {chainName} transaction.
                        Chain Receipt provides deterministic, privacy-first interpretation of on-chain data.
                    </p>
                </header>

                {/* SEO Content Block - Visible but unobtrusive */}
                <section className="mb-12 space-y-6 z-10 relative border-l-2 border-white/10 pl-6">
                    <h2 className="text-2xl font-bold text-white">Transaction Intelligence</h2>
                    <p className="text-zinc-400">
                        This page represents a secure, audit-ready entry for transaction <strong>{txHash}</strong> on the <strong>{chainName}</strong> network.
                        Our system classifies the intent (e.g., Swap, Transfer, Mint) and assigns a confidence score to ensure accuracy for accounting and compliance purposes.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <h3 className="font-semibold text-zinc-200 mb-2">Deterministic Output</h3>
                            <p className="text-sm text-zinc-500">Every analysis is reproducible and verified against on-chain state.</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <h3 className="font-semibold text-zinc-200 mb-2">Privacy First</h3>
                            <p className="text-sm text-zinc-500">We do not store your wallet address or transaction history. Analysis is performed on-demand.</p>
                        </div>
                    </div>
                </section>

                {/* Client-Side Loader / Redirector */}
                <div className="bg-[#0F0F11] rounded-3xl p-8 border border-white/10 text-center">
                    <h2 className="text-xl font-bold mb-4">Generating Full Receipt...</h2>
                    {/* This button would conceptually link back to home with pre-filled state, 
                 or we could mount the BillPreview component here. 
                 For MVP V1 SEO, we link back to the main app flow. */}
                    <Link
                        href={`/?chain=${chain}&tx=${txHash}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition-all hover:bg-violet-500 shadow-lg shadow-violet-600/20"
                    >
                        View Full Audit Report
                    </Link>
                </div>

                {/* Structured Data */}
                <Script
                    id="structured-data"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </div>
        </div>
    );
}
