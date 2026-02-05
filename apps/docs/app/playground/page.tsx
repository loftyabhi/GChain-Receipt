"use client";

import { useState, useRef, useEffect } from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { StatusBadge, Status } from "@/components/ui/StatusBadge";
import { Play, RotateCw, Lock, Globe, Zap, AlertCircle, CheckCircle, Server } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- API CONFIG ---
const ENV_URLS = {
    prod: "https://api.txproof.xyz",
    local: "http://localhost:3001"
};

type Method = "GET" | "POST" | "DELETE";

interface EndpointOpt {
    method: Method;
    path: string;
    label: string;
    defaultBody?: string;
}

const ENDPOINTS: EndpointOpt[] = [
    { method: "GET", path: "/api/v1/usage", label: "Get Usage Quota" },
    { method: "POST", path: "/api/v1/bills/resolve", label: "Generate Receipt (Job)", defaultBody: '{\n  "txHash": "0x71c6d98c5b9626bb36c3427389659b964348651811562916960897f22312d83f",\n  "chainId": 1\n}' },
    { method: "GET", path: "/api/v1/bills/job/:jobId", label: "Get Job Status" },
    { method: "POST", path: "/api/v1/verify/receipt", label: "Verify Receipt", defaultBody: '{\n  "billId": "bill-1-0x...",\n  "expectedHash": "..." \n}' },
    { method: "GET", path: "/api/v1/webhooks", label: "List Webhooks" },
    { method: "POST", path: "/api/v1/webhooks", label: "Create Webhook", defaultBody: '{\n  "url": "https://your-site.com/hook",\n  "events": ["bill.created"]\n}' },
];

const PRESETS = [
    { label: "Check Usage", endpointIdx: 0 },
    { label: "New Receipt Job", endpointIdx: 1 },
    { label: "List Webhooks", endpointIdx: 4 },
];

export default function PlaygroundPage() {
    // Auth State
    const [apiKey, setApiKey] = useState("");
    const [authMode, setAuthMode] = useState<'apikey' | 'jwt'>('apikey');

    // Environment State
    const [env, setEnv] = useState<'prod' | 'local'>('prod');

    // Request State
    const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointOpt>(ENDPOINTS[0]);
    const [customPath, setCustomPath] = useState(ENDPOINTS[0].path);
    const [method, setMethod] = useState<Method>(ENDPOINTS[0].method);
    const [body, setBody] = useState("");
    const [headers, setHeaders] = useState<Record<string, string>>({});

    // Execution State
    const [status, setStatus] = useState<Status | "idle">("idle");
    const [response, setResponse] = useState<any>(null);
    const [responseStats, setResponseStats] = useState({ status: 0, time: 0, size: 0 });
    const [quotaStats, setQuotaStats] = useState<{ limit: number, remaining: number } | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Sync form when endpoint selection changes
    useEffect(() => {
        setCustomPath(selectedEndpoint.path);
        setMethod(selectedEndpoint.method);
        setBody(selectedEndpoint.defaultBody || "");
        setResponse(null);
        setStatus("idle");
        setLogs([]);
        setQuotaStats(null);
    }, [selectedEndpoint]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`, ...prev]);
    };

    const runRequest = async () => {
        if (!apiKey) {
            alert("Please enter an API Key (or JWT) to execute requests.");
            return;
        }

        // Strict Validation
        if (method !== 'GET' && method !== 'DELETE' && body) {
            try {
                JSON.parse(body);
            } catch (e) {
                alert("Invalid JSON body. Please fix syntax errors before sending.");
                return;
            }
        }

        setStatus("processing");
        setLogs([]);
        setResponse(null);
        setQuotaStats(null);

        const startTime = Date.now();
        let finalPath = customPath;

        // Interactive Param Replacement
        if (finalPath.includes(":jobId")) {
            const id = prompt("Enter jobId:");
            if (!id) { setStatus("idle"); return; }
            finalPath = finalPath.replace(":jobId", id);
        }
        if (finalPath.includes(":billId")) {
            const id = prompt("Enter billId:");
            if (!id) { setStatus("idle"); return; }
            finalPath = finalPath.replace(":billId", id);
        }

        const baseUrl = ENV_URLS[env];
        const url = `${baseUrl}${finalPath}`;

        addLog(`${method} ${finalPath}`);
        addLog(`Env: ${env.toUpperCase()} (${baseUrl})`);

        try {
            const reqHeaders: HeadersInit = {
                "Content-Type": "application/json",
                ...headers
            };

            if (authMode === 'apikey') {
                reqHeaders['X-API-Key'] = apiKey;
            } else {
                reqHeaders['Authorization'] = `Bearer ${apiKey}`;
            }

            const fetchOpts: RequestInit = {
                method,
                headers: reqHeaders,
            };

            if (method !== 'GET' && method !== 'DELETE' && body) {
                fetchOpts.body = body;
            }

            const res = await fetch(url, fetchOpts);
            const time = Date.now() - startTime;
            const size = res.headers.get("content-length") || 0;

            // Extract quota headers
            const qLimit = res.headers.get("x-quota-limit");
            const qRemaining = res.headers.get("x-quota-remaining");

            if (qLimit && qRemaining) {
                setQuotaStats({
                    limit: parseInt(qLimit),
                    remaining: parseInt(qRemaining)
                });
                addLog(`Quota: ${qRemaining}/${qLimit} remaining`);
            }

            const data = await res.json().catch(() => ({ error: "Invalid JSON response" }));

            setResponseStats({
                status: res.status,
                time,
                size: Number(size)
            });
            setResponse(data);

            if (res.ok) {
                setStatus("completed");
                addLog(`Success: ${res.status} OK`);
            } else {
                setStatus("failed");
                addLog(`Failed: ${res.status} ${res.statusText}`);
            }

        } catch (error: any) {
            setStatus("failed");
            addLog(`Network Error: ${error.message}`);
            setResponse({ error: "Network Error - check CORS or connectivity" });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Live API Playground</h1>
                <p className="text-lg text-muted-foreground">
                    Test endpoints directly against the API. Keys are never stored.
                </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 h-[800px]">
                {/* --- LEFT: CONFIG --- */}
                <div className="lg:col-span-4 flex flex-col gap-6 h-full">

                    {/* Auth & Env Config */}
                    <div className="p-5 border border-border rounded-xl bg-card space-y-4 shadow-sm">

                        {/* Env Toggle */}
                        <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between border border-border/50">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Server className="w-4 h-4 text-purple-500" />
                                <span>Environment</span>
                            </div>
                            <div className="flex bg-muted rounded p-0.5">
                                <button
                                    onClick={() => setEnv('prod')}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${env === 'prod' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground'}`}
                                >Production</button>
                                <button
                                    onClick={() => setEnv('local')}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${env === 'local' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground'}`}
                                >Localhost</button>
                            </div>
                        </div>

                        {/* Credentials */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <Lock className="w-3 h-3 text-primary" />
                                    Credentials
                                </h3>
                                <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                    <span onClick={() => setAuthMode('apikey')} className={`cursor-pointer ${authMode === 'apikey' ? 'text-primary' : ''}`}>API Key</span>
                                    <span>/</span>
                                    <span onClick={() => setAuthMode('jwt')} className={`cursor-pointer ${authMode === 'jwt' ? 'text-primary' : ''}`}>JWT</span>
                                </div>
                            </div>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder={authMode === 'apikey' ? "tx_p_live_..." : "eyJ..."}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    {/* Request Builder */}
                    <div className="flex-1 border border-border rounded-xl bg-card flex flex-col shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-500" />
                                Request
                            </h3>
                        </div>

                        <div className="p-5 flex-1 space-y-5 overflow-y-auto">
                            {/* Presets */}
                            <div className="flex flex-wrap gap-2">
                                {PRESETS.map((preset, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedEndpoint(ENDPOINTS[preset.endpointIdx])}
                                        className="text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors font-medium flex items-center gap-1"
                                    >
                                        <Zap className="w-3 h-3" />
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            {/* Endpoint Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">Endpoint</label>
                                <select
                                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm outline-none"
                                    value={selectedEndpoint.path}
                                    onChange={e => {
                                        const found = ENDPOINTS.find(ep => ep.path === e.target.value);
                                        if (found) setSelectedEndpoint(found);
                                    }}
                                >
                                    {ENDPOINTS.map(ep => (
                                        <option key={ep.path} value={ep.path}>
                                            {ep.method} {ep.path} - {ep.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Method & Path */}
                            <div className="flex gap-2">
                                <select
                                    className="px-3 py-2 font-bold bg-muted/50 border border-border rounded-md text-sm outline-none"
                                    value={method}
                                    onChange={e => setMethod(e.target.value as Method)}
                                >
                                    <option>GET</option>
                                    <option>POST</option>
                                    <option>DELETE</option>
                                </select>
                                <input
                                    type="text"
                                    value={customPath}
                                    onChange={e => setCustomPath(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm font-mono outline-none"
                                />
                            </div>

                            {/* Body Editor */}
                            {(method === 'POST') && (
                                <div className="space-y-2 h-64 flex flex-col">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground">JSON Body</label>
                                    </div>
                                    <textarea
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        className="flex-1 w-full p-3 bg-zinc-950 text-zinc-100 font-mono text-xs rounded-md border border-border resize-none outline-none focus:border-primary/50"
                                        spellCheck={false}
                                    />
                                </div>
                            )}

                            <button
                                onClick={runRequest}
                                disabled={status === "processing"}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 mt-auto"
                            >
                                {status === "processing" ? (
                                    <RotateCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                                Execute Request
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: RESPONSE --- */}
                <div className="lg:col-span-8 flex flex-col gap-6 h-full">
                    <div className="flex-1 border border-border rounded-xl bg-[#1e1e1e] text-zinc-300 flex flex-col shadow-lg overflow-hidden relative">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm font-mono">
                                <span className="text-zinc-400">Response</span>
                                {response && (
                                    <>
                                        <span className={responseStats.status >= 200 && responseStats.status < 300 ? "text-green-400" : "text-red-400"}>
                                            {responseStats.status}
                                        </span>
                                        <span className="text-zinc-600">|</span>
                                        <span>{responseStats.time}ms</span>
                                        <span className="text-zinc-600">|</span>
                                        <span>{responseStats.size} B</span>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <StatusBadge status={status} />
                            </div>
                        </div>

                        {/* Quota Visualizer */}
                        <AnimatePresence>
                            {quotaStats && (
                                <motion.div
                                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                    className="border-b border-white/10 bg-blue-500/10 overflow-hidden"
                                >
                                    <div className="px-4 py-2 flex items-center gap-4 text-xs font-mono text-blue-300">
                                        <span className="font-semibold uppercase tracking-wider text-blue-400">Monthly Quota</span>
                                        <div className="flex-1 h-2 bg-blue-900/30 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-500"
                                                style={{ width: `${(quotaStats.remaining / quotaStats.limit) * 100}%` }}
                                            />
                                        </div>
                                        <span>{quotaStats.remaining.toLocaleString()} / {quotaStats.limit.toLocaleString()} remaining</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-h-0">

                            {/* Logs */}
                            <div className="h-32 border-b border-white/10 bg-black/20 p-2 overflow-y-auto font-mono text-xs">
                                {logs.length === 0 && <span className="text-zinc-600 italic px-2">Events will appear here...</span>}
                                {logs.map((log, i) => (
                                    <div key={i} className="px-2 py-0.5 hover:bg-white/5 transition-colors truncate">
                                        {log}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>

                            {/* Main JSON Viewer */}
                            <div className="flex-1 relative overflow-hidden group">
                                {response ? (
                                    <pre className="absolute inset-0 p-4 font-mono text-sm overflow-auto text-green-300 selection:bg-green-900/50">
                                        {JSON.stringify(response, null, 2)}
                                    </pre>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                                        <div className="text-center space-y-2">
                                            <Play className="w-12 h-12 mx-auto opacity-20" />
                                            <p>Ready to execute</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
