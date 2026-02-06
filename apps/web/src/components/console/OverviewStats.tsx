import React from 'react';

interface StatsProps {
    usageData: { logs_count: number };
    totalQuota: number;
    billingTier: string;
    isSystemOperational: boolean;
}

export const OverviewStats: React.FC<StatsProps> = ({ usageData, totalQuota, billingTier, isSystemOperational }) => {
    // Calculate global percentage or other derived metrics
    const pct = totalQuota > 0 ? Math.min(100, (usageData.logs_count / totalQuota) * 100) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="text-sm text-gray-400 mb-2">Current Plan</div>
                <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white uppercase tracking-wider">{billingTier}</span>
                    <button className="text-xs bg-gradient-to-r from-yellow-600 to-amber-600 text-white px-3 py-1.5 rounded-full font-medium shadow-lg hover:shadow-yellow-500/20 transition-all uppercase tracking-wide">
                        Upgrade
                    </button>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="text-sm text-gray-400 mb-2">Monthly Usage</div>
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold text-white">{(usageData?.logs_count || 0).toLocaleString()}</span>
                    <span className="text-sm text-gray-500 mb-1">/ {(totalQuota || 0).toLocaleString()} reqs</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${pct > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <div className="text-sm text-gray-400 mb-2">Platform Health</div>
                <div className="flex items-center gap-2">
                    {isSystemOperational ? (
                        <>
                            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-xl font-medium text-white">Operational</span>
                        </>
                    ) : (
                        <>
                            <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                            <span className="text-xl font-medium text-white">Degraded</span>
                        </>
                    )}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                    {isSystemOperational ? 'All systems valid. No outages.' : 'Some services are experiencing issues.'}
                </div>
            </div>
        </div>
    );
};
