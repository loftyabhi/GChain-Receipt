import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Page Not Found | Chain Receipt',
    description: 'This page does not exist. Blockchain data remains unchanged.',
    robots: {
        index: false,
        follow: true,
    },
};

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center p-6 selection:bg-violet-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-lg w-full text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold tracking-wide uppercase mb-8">
                    404 Error
                </div>

                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                    Page Not Found
                </h1>

                <p className="text-lg text-zinc-400 mb-10 leading-relaxed">
                    This page does not exist or may have been moved.
                    <br className="hidden md:block" />
                    <span className="text-zinc-500">Blockchain data remains unchanged.</span>
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                        href="/"
                        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
                    >
                        Go to Home
                    </Link>
                    <Link
                        href="/"
                        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors"
                    >
                        Analyze a Transaction
                    </Link>
                </div>
            </div>
        </div>
    );
}
