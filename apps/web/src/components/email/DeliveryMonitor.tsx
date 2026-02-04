'use client';

import { useState, useEffect } from 'react';

interface EmailStats {
    queued: number;
    sent: number;
    failed: number;
    recentFailures: any[];
}

export default function DeliveryMonitor() {
    const [stats, setStats] = useState<EmailStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/v1/admin/email/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // 5s refresh
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-4 text-gray-400">Loading metrics...</div>;
    if (!stats) return <div className="p-4 text-red-400">Failed to load metrics</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-gray-400 text-sm font-medium">Queued</h3>
                    <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.queued}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-gray-400 text-sm font-medium">Sent</h3>
                    <p className="text-3xl font-bold text-green-400 mt-2">{stats.sent}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-gray-400 text-sm font-medium">Failed</h3>
                    <p className="text-3xl font-bold text-red-400 mt-2">{stats.failed}</p>
                </div>
            </div>

            {/* Recent Failures */}
            {stats.recentFailures && stats.recentFailures.length > 0 && (
                <div className="bg-gray-900 border border-red-900/50 rounded-lg p-4">
                    <h3 className="text-red-400 font-semibold mb-3">Recent Failures</h3>
                    <div className="space-y-2">
                        {stats.recentFailures.map((fail: any) => (
                            <div key={fail.id} className="text-sm bg-red-900/10 p-2 rounded flex justify-between items-start">
                                <div>
                                    <span className="font-mono text-gray-300">{fail.recipient_email}</span>
                                    <p className="text-red-300/80 mt-1">{fail.error}</p>
                                </div>
                                <span className="text-xs text-gray-500">
                                    Attempts: {fail.attempt_count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
