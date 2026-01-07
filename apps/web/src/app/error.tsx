'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Optionally log to error reporting service
        console.error('Application Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center p-6 selection:bg-violet-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-lg w-full text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold tracking-wide uppercase mb-8">
                    Processing Error
                </div>

                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                    Temporary Service Issue
                </h1>

                <p className="text-lg text-zinc-400 mb-10 leading-relaxed">
                    We encountered an internal issue while processing this request.
                    <br className="hidden md:block" />
                    <span className="text-zinc-500">No data was lost or modified.</span>
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={reset}
                        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
                    >
                        Retry Request
                    </button>
                    <Link
                        href="/"
                        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors"
                    >
                        Return to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
