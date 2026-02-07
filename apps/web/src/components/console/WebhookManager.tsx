'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Send, Copy, X } from 'lucide-react';

interface Webhook {
    id: string;
    url: string;
    events: string[];
    is_active: boolean;
    health_status: 'active' | 'broken' | 'rotated';
    health_error?: string;
    last_health_check?: string;
    created_at: string;
}

interface WebhookManagerProps {
    token: string;
}

interface TestResult {
    success: boolean;
    statusCode?: number;
    responseTime?: number;
    error?: string;
    requestPayload?: any;
    responseBody?: string;
}

export const WebhookManager: React.FC<WebhookManagerProps> = ({ token }) => {
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [url, setUrl] = useState('');
    const [events, setEvents] = useState<string[]>(['bill.completed', 'bill.failed']);

    // New Webhook Secret Display
    const [newSecret, setNewSecret] = useState<string | null>(null);

    // Test State
    const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [showTestModal, setShowTestModal] = useState(false);

    // Delete Confirmation State
    const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);

    // Rotate Confirmation State
    const [rotateWebhookId, setRotateWebhookId] = useState<string | null>(null);
    const [isRotating, setIsRotating] = useState(false);

    const fetchWebhooks = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setWebhooks(await res.json());
            }
        } catch (error) {
            console.error('Failed to fetch webhooks', error);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) fetchWebhooks();
    }, [token, fetchWebhooks]);

    const handleCreate = async () => {
        if (!url) {
            toast.error('Please enter a valid URL');
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, events })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to create webhook');

            // Show secret
            setNewSecret(data.secret);
            toast.success('Webhook created successfully');

            // Reset form
            setUrl('');
            setIsCreating(false);
            fetchWebhooks();

        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleTest = async (webhookId: string) => {
        setTestingWebhookId(webhookId);
        setTestResult(null);
        setShowTestModal(true);

        try {
            const startTime = Date.now();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/${webhookId}/test`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            const responseTime = Date.now() - startTime;
            const data = await res.json();

            if (res.ok) {
                setTestResult({
                    success: true,
                    statusCode: data.statusCode || 200,
                    responseTime,
                    requestPayload: data.payload,
                    responseBody: data.response
                });
                toast.success('Test webhook delivered successfully');
            } else {
                setTestResult({
                    success: false,
                    error: data.error || 'Test failed',
                    requestPayload: data.payload
                });
                toast.error('Test webhook failed');
            }
        } catch (e: any) {
            setTestResult({
                success: false,
                error: e.message || 'Network error'
            });
            toast.error('Failed to send test webhook');
        } finally {
            setTestingWebhookId(null);
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteWebhookId(id);
    };

    const confirmDelete = async () => {
        if (!deleteWebhookId) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/${deleteWebhookId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success('Webhook deleted');
                fetchWebhooks();
            } else {
                toast.error('Failed to delete webhook');
            }
        } catch (e) {
            toast.error('Error deleting webhook');
        } finally {
            setDeleteWebhookId(null);
        }
    };

    const handleRotateClick = (id: string) => {
        setRotateWebhookId(id);
    };

    const confirmRotate = async () => {
        if (!rotateWebhookId) return;
        setIsRotating(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/${rotateWebhookId}/rotate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('Webhook secret rotated');
                setNewSecret(data.secret); // Reuse new secret modal
                fetchWebhooks();
            } else {
                toast.error(data.error || 'Failed to rotate secret');
            }
        } catch (e: any) {
            toast.error('Error rotating secret');
        } finally {
            setIsRotating(false);
            setRotateWebhookId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Webhooks</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    + Add Endpoint
                </button>
            </div>

            {/* Test Result Modal */}
            {showTestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Send size={20} className="text-blue-400" />
                                Webhook Test Result
                            </h3>
                            <button
                                onClick={() => setShowTestModal(false)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {!testResult ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 size={40} className="text-blue-400 animate-spin mb-4" />
                                    <p className="text-gray-400">Sending test event...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Status Banner */}
                                    <div className={`p-4 rounded-xl border flex items-center gap-3 ${testResult.success
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : 'bg-red-500/10 border-red-500/30'
                                        }`}>
                                        {testResult.success ? (
                                            <>
                                                <CheckCircle2 size={24} className="text-green-400" />
                                                <div>
                                                    <p className="text-green-400 font-semibold">Webhook delivered successfully</p>
                                                    <p className="text-sm text-gray-400">
                                                        Status: {testResult.statusCode} • Response time: {testResult.responseTime}ms
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle size={24} className="text-red-400" />
                                                <div>
                                                    <p className="text-red-400 font-semibold">Webhook delivery failed</p>
                                                    <p className="text-sm text-gray-400">{testResult.error}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Request Payload */}
                                    {testResult.requestPayload && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-semibold text-gray-400 uppercase">Request Payload</label>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(JSON.stringify(testResult.requestPayload, null, 2));
                                                        toast.success('Copied to clipboard');
                                                    }}
                                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                                >
                                                    <Copy size={12} />
                                                    Copy
                                                </button>
                                            </div>
                                            <pre className="bg-black border border-white/10 rounded-lg p-4 text-xs text-green-300 font-mono overflow-x-auto">
                                                {JSON.stringify(testResult.requestPayload, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    {/* Response Body */}
                                    {testResult.responseBody && (
                                        <div>
                                            <label className="text-sm font-semibold text-gray-400 uppercase mb-2 block">Response Body</label>
                                            <pre className="bg-black border border-white/10 rounded-lg p-4 text-xs text-gray-300 font-mono overflow-x-auto max-h-48">
                                                {testResult.responseBody}
                                            </pre>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-white/10 flex justify-end">
                            <button
                                onClick={() => setShowTestModal(false)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Secret Display Modal */}
            {newSecret && (
                <div className="bg-green-900/10 border border-green-500/30 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-green-400 mb-2">Webhook Created!</h3>
                    <p className="text-gray-400 text-sm mb-4">
                        Please save this signing secret. It will verify that events originated from TxProof.
                        <br />It will <strong>not</strong> be shown again.
                    </p>
                    <div className="bg-black border border-white/10 rounded p-3 flex justify-between items-center group">
                        <code className="text-green-300 font-mono text-sm break-all">{newSecret}</code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(newSecret);
                                toast.success('Copied to clipboard');
                            }}
                            className="bg-white/10 hover:bg-white/20 text-xs px-2 py-1 rounded text-white ml-2"
                        >
                            Copy
                        </button>
                    </div>
                    <button
                        onClick={() => setNewSecret(null)}
                        className="mt-4 text-sm text-gray-400 hover:text-white underline"
                    >
                        I have saved it
                    </button>
                </div>
            )}

            {/* Create Form */}
            {isCreating && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-medium text-white mb-4">New Webhook Endpoint</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Endpoint URL</label>
                            <input
                                type="url"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                placeholder="https://api.yourapp.com/webhooks/txproof"
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Events to Subscribe</label>
                            <div className="flex gap-2">
                                <label className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded border border-blue-500/50 text-blue-200 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={events.includes('bill.completed')}
                                        onChange={() => {
                                            if (events.includes('bill.completed')) {
                                                setEvents(events.filter(e => e !== 'bill.completed'));
                                            } else {
                                                setEvents([...events, 'bill.completed']);
                                            }
                                        }}
                                    />
                                    bill.completed
                                </label>
                                <label className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded border border-red-500/50 text-red-200 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={events.includes('bill.failed')}
                                        onChange={() => {
                                            if (events.includes('bill.failed')) {
                                                setEvents(events.filter(e => e !== 'bill.failed'));
                                            } else {
                                                setEvents([...events, 'bill.failed']);
                                            }
                                        }}
                                    />
                                    bill.failed
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                            >
                                Create Webhook
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid gap-4">
                {isLoading && webhooks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Loading webhooks...</div>
                ) : webhooks.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-gray-400 mb-2">No webhooks configured</p>
                        <p className="text-sm text-gray-600">Add an endpoint to receive real-time updates.</p>
                    </div>
                ) : (
                    webhooks.map(wh => (
                        <div key={wh.id} className={`bg-white/5 border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${wh.health_status === 'broken' ? 'border-red-500/30 bg-red-500/5' : 'border-white/10'
                            }`}>
                            <div className="overflow-hidden">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-sm text-blue-300 truncate max-w-md" title={wh.url}>{wh.url}</span>

                                    {/* Status Badges */}
                                    {wh.health_status === 'active' && (
                                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Active
                                        </span>
                                    )}
                                    {wh.health_status === 'broken' && (
                                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center gap-1 font-bold">
                                            <XCircle size={10} /> Broken
                                        </span>
                                    )}
                                    {wh.health_status === 'rotated' && (
                                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">Rotated</span>
                                    )}
                                </div>
                                <div className="flex gap-2 text-xs text-gray-500">
                                    <span>Events: {wh.events.join(', ')}</span>
                                    <span>•</span>
                                    <span>Created {new Date(wh.created_at).toLocaleDateString()}</span>
                                </div>
                                {wh.health_status === 'broken' && wh.health_error && (
                                    <div className="mt-2 text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50">
                                        <strong>Delivery Stopped:</strong> {wh.health_error}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleTest(wh.id)}
                                    disabled={testingWebhookId === wh.id || wh.health_status === 'broken'}
                                    className="text-xs text-gray-400 hover:text-white border border-transparent hover:border-white/10 px-3 py-1.5 rounded transition disabled:opacity-50 flex items-center gap-1"
                                >
                                    {testingWebhookId === wh.id ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            Testing...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={12} />
                                            Test
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => handleRotateClick(wh.id)}
                                    className="text-xs text-yellow-500/80 hover:text-yellow-400 border border-transparent hover:border-yellow-500/20 hover:bg-yellow-500/10 px-3 py-1.5 rounded transition"
                                >
                                    Rotate Secret
                                </button>

                                <button
                                    onClick={() => handleDeleteClick(wh.id)}
                                    className="text-xs text-red-400 hover:text-red-300 border border-transparent hover:border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteWebhookId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-3">Delete Webhook?</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Are you sure you want to delete this webhook? This action cannot be undone and any applications using this endpoint will immediately stop receiving events.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteWebhookId(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Delete Webhook
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
