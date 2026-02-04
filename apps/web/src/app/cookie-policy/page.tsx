import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { constructCanonical, generateBreadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'Cookie Policy',
    description: 'Information about the cookies and local storage used by TxProof to ensure platform security and performance.',
    alternates: {
        canonical: constructCanonical('/cookie-policy'),
    },
};

const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Cookie Policy', item: '/cookie-policy' },
];

export default function CookiePolicy() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-violet-500/30 overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <Navbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto pt-32 pb-20 px-6 space-y-8">
                <header className="mb-12 border-b border-white/10 pb-8 text-center md:text-left">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Cookie Policy</h1>
                    <p className="text-lg text-zinc-400">
                        Last Updated: February 04, 2026
                    </p>
                </header>

                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white">1. What are Cookies?</h2>
                    <p>
                        Cookies are small text files stored in your browser. We also use Local Storage for non-expiring preferences. Unlike many platforms, TxProof limits its use of cookies to strictly essential functions and anonymized performance metrics.
                    </p>
                </section>

                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white">2. Essential Cookies</h2>
                    <p>
                        These cookies are required for the platform to function and cannot be switched off. They do not store any personally identifiable information.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-white/10 text-sm">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="p-4 border-b border-white/10">Name</th>
                                    <th className="p-4 border-b border-white/10">Purpose</th>
                                    <th className="p-4 border-b border-white/10">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">admin_token</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Maintains secure session state for authorized administrators. Set to HttpOnly and Secure.</td>
                                    <td className="p-4 border-b border-white/10">30 Minutes</td>
                                </tr>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">csrf_token</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Prevents Cross-Site Request Forgery (CSRF) attacks to protect your account data.</td>
                                    <td className="p-4 border-b border-white/10">Session</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white">3. Platform Preferences & Authentication</h2>
                    <p>
                        We use Local Storage to maintain your session state and configuration choices. Unlike traditional cookies, these are not sent to our servers with every request, enhancing privacy and performance.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-white/10 text-sm">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="p-4 border-b border-white/10">Key (LocalStorage)</th>
                                    <th className="p-4 border-b border-white/10">Purpose</th>
                                    <th className="p-4 border-b border-white/10">Standard Retention</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">txproof_console_token</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Stores your secure access token for the dashboard and API management.</td>
                                    <td className="p-4 border-b border-white/10">Permanent until logout</td>
                                </tr>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">txproof_console_user</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Caches your profile information (Wallet Address, Verification Status) for UI persistence.</td>
                                    <td className="p-4 border-b border-white/10">Permanent until logout</td>
                                </tr>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">cookie_consent</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Remembers whether you have accepted or denied optional analytics tracking.</td>
                                    <td className="p-4 border-b border-white/10">Permanent until cleared</td>
                                </tr>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">wagmi.store</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Maintains your Web3 wallet connection state via the Wagmi/Viem connector.</td>
                                    <td className="p-4 border-b border-white/10">Provider defined</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white">4. Performance & Analytics</h2>
                    <p>
                        With your consent, we use Google Analytics 4 (GA4) to understand platform performance. No personally identifiable information is shared with Google; IP addresses are truncated (Anonymized) before storage.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-white/10 text-sm">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="p-4 border-b border-white/10">Cookie Name</th>
                                    <th className="p-4 border-b border-white/10">Purpose</th>
                                    <th className="p-4 border-b border-white/10">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">_ga</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Used by Google Analytics to distinguish unique users by assigning a randomly generated number as a client identifier.</td>
                                    <td className="p-4 border-b border-white/10">2 Years</td>
                                </tr>
                                <tr>
                                    <td className="p-4 border-b border-white/10 text-violet-400 font-mono">_ga_*</td>
                                    <td className="p-4 border-b border-white/10 text-zinc-400">Used by Google Analytics to persist session state.</td>
                                    <td className="p-4 border-b border-white/10">1 Year</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white">5. How to Manage Cookies</h2>
                    <p>
                        You can clear cookies and local storage at any time via your browser settings. Please note that clearing essential cookies will log you out of any active sessions.
                    </p>
                </section>
            </div>
        </div>
    );
}
