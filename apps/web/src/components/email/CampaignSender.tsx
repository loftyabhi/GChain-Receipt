'use client';

import { useState, useEffect } from 'react';

export default function CampaignSender() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        templateId: '',
        category: 'promotional',
        audience: 'verified_users',
        targetEmail: ''
    });

    useEffect(() => {
        fetch('/api/v1/admin/email/templates')
            .then(res => res.json())
            .then(data => setTemplates(data));
    }, []);

    const handleSend = async () => {
        if (!confirm('Are you sure you want to send this campaign?')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/v1/admin/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: form.category,
                    templateId: form.templateId,
                    audience: form.audience,
                    segmentConfig: form.audience === 'single' ? { email: form.targetEmail } : undefined
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to send campaign');
        } finally {
            setLoading(false);
        }
    };

    // Filter templates by category
    const availableTemplates = templates.filter(t => t.category === form.category);

    return (
        <div className="max-w-2xl mx-auto bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-6">Send Campaign</h2>

            <div className="space-y-6">
                {/* Category */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                    <div className="flex gap-4">
                        <label className={`flex-1 p-3 rounded border cursor-pointer flex items-center justify-center gap-2 ${form.category === 'promotional' ? 'border-purple-500 bg-purple-900/20 text-purple-200' : 'border-gray-600 bg-gray-700 hover:bg-gray-600'}`}>
                            <input
                                type="radio" className="hidden"
                                checked={form.category === 'promotional'}
                                onChange={() => setForm({ ...form, category: 'promotional', templateId: '' })}
                            />
                            📢 Promotional
                        </label>
                        <label className={`flex-1 p-3 rounded border cursor-pointer flex items-center justify-center gap-2 ${form.category === 'transactional' ? 'border-green-500 bg-green-900/20 text-green-200' : 'border-gray-600 bg-gray-700 hover:bg-gray-600'}`}>
                            <input
                                type="radio" className="hidden"
                                checked={form.category === 'transactional'}
                                onChange={() => setForm({ ...form, category: 'transactional', templateId: '' })}
                            />
                            🔒 Transactional
                        </label>
                    </div>
                    {form.category === 'transactional' && (
                        <p className="text-xs text-yellow-500 mt-2">
                            ⚠️ Transactional emails bypass opt-in. Use ONLY for security alerts, policy updates, etc.
                        </p>
                    )}
                </div>

                {/* Audience */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Audience</label>
                    <select
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                        value={form.audience}
                        onChange={e => setForm({ ...form, audience: e.target.value })}
                    >
                        <option value="verified_users">All Verified Users</option>
                        <option value="single">Single User (Test)</option>
                        {/* <option value="all_users">All Users (Including Unverified)</option> - Hidden for safety */}
                    </select>

                    {form.audience === 'single' && (
                        <input
                            type="email"
                            placeholder="target@example.com"
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white mt-2"
                            value={form.targetEmail}
                            onChange={e => setForm({ ...form, targetEmail: e.target.value })}
                        />
                    )}
                </div>

                {/* Template */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Template</label>
                    <select
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                        value={form.templateId}
                        onChange={e => setForm({ ...form, templateId: e.target.value })}
                    >
                        <option value="">-- Select --</option>
                        {availableTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name} - {t.subject}</option>
                        ))}
                    </select>
                </div>

                {/* Submit */}
                <div className="pt-4 border-t border-gray-700">
                    <button
                        onClick={handleSend}
                        disabled={loading || !form.templateId || (form.audience === 'single' && !form.targetEmail)}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg shadow-lg transition-all"
                    >
                        {loading ? 'Queueing...' : `Send ${form.category === 'promotional' ? 'Campaign' : 'Alert'}`}
                    </button>
                    <p className="text-center text-xs text-gray-500 mt-2">
                        Emails are queued and sent at 2s intervals.
                    </p>
                </div>
            </div>
        </div>
    );
}
