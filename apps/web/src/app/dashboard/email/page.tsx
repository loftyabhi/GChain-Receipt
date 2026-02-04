'use client';

import { useState } from 'react';
import DeliveryMonitor from '../../components/email/DeliveryMonitor';
import TemplateManager from '../../components/email/TemplateManager';
import CampaignSender from '../../components/email/CampaignSender';

export default function EmailOpsPage() {
    const [tab, setTab] = useState<'monitor' | 'campaign' | 'templates'>('monitor');

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Email Operations</h1>
                    <p className="text-gray-400">Manage transactional & promotional campaigns</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-800 p-1 rounded-lg mt-4 md:mt-0">
                    <button
                        onClick={() => setTab('monitor')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === 'monitor' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        📊 Monitor
                    </button>
                    <button
                        onClick={() => setTab('campaign')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === 'campaign' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        🚀 Send
                    </button>
                    <button
                        onClick={() => setTab('templates')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tab === 'templates' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        📝 Templates
                    </button>
                </div>
            </div>

            <div className="min-h-[600px]">
                {tab === 'monitor' && <DeliveryMonitor />}
                {tab === 'campaign' && <CampaignSender />}
                {tab === 'templates' && <TemplateManager />}
            </div>
        </div>
    );
}
