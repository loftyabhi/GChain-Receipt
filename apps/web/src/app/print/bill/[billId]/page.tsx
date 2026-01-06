'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import './print.css';
import { BillViewModel } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BillPrintPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const billId = params?.billId as string;
    const isPreview = searchParams?.get('mode') === 'preview';

    const [data, setData] = useState<BillViewModel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!billId) return;

        const fetchData = async () => {
            try {
                // Fetch the Bill JSON data
                // We assume there will be an endpoint that returns the JSON directly
                // If not, we might need to adjust the backend to serve it.
                // Using a hypothetical endpoint for now based on implementation plan.
                const res = await fetch(`${API_URL}/api/v1/bills/${billId}/data`);

                if (!res.ok) {
                    if (res.status === 404) throw new Error('Bill not found');
                    throw new Error('Failed to fetch bill data');
                }

                const json = await res.json();
                setData(json);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [billId]);

    useEffect(() => {
        if (data) {
            document.title = `Chain Receipt - ${data.BILL_ID}`;
        }
    }, [data]);

    useEffect(() => {
        if (!data || loading || isPreview) return; // Skip print in preview mode

        // Deterministic Print Readiness Check
        const checkReadiness = async () => {
            try {
                // 1. Wait for Fonts
                await document.fonts.ready;

                // 2. Wait for Images
                const images = Array.from(document.images);
                await Promise.all(images.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve; // Don't block on broken images
                    });
                }));

                // 3. Small buffer to ensure paint is complete implies "Ready" state
                // We use requestAnimationFrame to ensure we are in a valid paint frame
                // followed by a timeout to allow the browser to compositing to finish.
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                });

            } catch (e) {
                console.error("Print readiness check failed", e);
                // Fallback
                window.print();
            }
        };

        checkReadiness();
    }, [data, loading, isPreview]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Bill Data...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    if (!data) return null;

    return (
        <div className="page">
            {/* Screen-Only Print Hint */}
            <div className="no-print p-4 mb-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 flex justify-between items-center max-w-2xl mx-auto mt-4">
                <span>
                    <strong>Legacy Print Mode:</strong> For best results, enable <em>Background graphics</em> in your browser's print settings.
                </span>
                <button
                    onClick={() => window.print()}
                    className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                >
                    Print Now
                </button>
            </div>

            {/* HEADER */}
            <main className="page-content">
                <div className="header">
                    <div className="brand">
                        <div className="brand-icon">⚡</div>
                        <div className="brand-info">
                            <h1>Chain Receipt</h1>
                            <div className="brand-tagline">Professional Blockchain Intelligence</div>
                        </div>
                    </div>
                    <div className="receipt-meta">
                        <h2 className="receipt-title">Transaction Receipt</h2>
                        <div className="receipt-id">#{data.BILL_ID}</div>
                        <div className="uppercase-label" style={{ marginTop: '4px' }}>{data.GENERATED_AT}</div>
                    </div>
                </div>

                {/* STATUS & NETWORK */}
                <div className="status-bar">
                    <div className="status-indicator">
                        <span className={`status-badge ${data.STATUS_CONFIRMED ? 'confirmed' : 'failed'}`}>
                            {data.STATUS_CONFIRMED ? '✔ Confirmed' : '✖ Failed'}
                        </span>
                        <span className="status-badge"
                            style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                            {data.TYPE_READABLE}
                        </span>
                        {data.IS_MULTISIG && (
                            <span className="status-badge"
                                style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                🛡️ Multisig
                            </span>
                        )}
                        {data.IS_SMART_ACCOUNT && (
                            <span className="status-badge"
                                style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>
                                🤖 Smart Account
                            </span>
                        )}
                    </div>
                    <div className="chain-info">
                        <div className="chain-badge">
                            {/* Assuming CHAIN_ICON is an emoji based on template usage */}
                            <span>{data.CHAIN_ICON}</span>
                            <span>{data.CHAIN_NAME} ({data.CHAIN_ID})</span>
                        </div>
                    </div>
                </div>

                {/* KEY DETAILS GRID */}
                <div className="grid-4">
                    <div className="data-group">
                        <div className="uppercase-label">Timestamp</div>
                        <div className="data-value">{data.TIMESTAMP}</div>
                        <div className="text-secondary" style={{ fontSize: '10px' }}>{data.TIMESTAMP_RELATIVE}</div>
                    </div>
                    <div className="data-group">
                        <div className="uppercase-label">Block Height</div>
                        <div className="data-value mono">#{data.BLOCK_NUMBER}</div>
                    </div>
                    <div className="data-group" style={{ gridColumn: 'span 2' }}>
                        <div className="uppercase-label">Transaction Hash</div>
                        <div className="data-value mono" style={{ fontSize: '11px' }}>{data.TRANSACTION_HASH}</div>
                    </div>
                </div>

                {/* PARTICIPANTS */}
                <div className="grid-2">
                    <div className="participant-card">
                        <div className="participant-header">
                            <div className="uppercase-label">Sender (From)</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flexStart', gap: '12px' }}>
                            <div className="avatar">{data.FROM_AVATAR}</div>
                            <div>
                                {data.FROM_ENS && <div className="data-value">{data.FROM_ENS}</div>}
                                <div className="data-value mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                    {data.FROM_ADDRESS}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="participant-card">
                        <div className="participant-header">
                            <div className="uppercase-label">Recipient (To)</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flexStart', gap: '12px' }}>
                            <div className="avatar">{data.TO_AVATAR}</div>
                            <div>
                                {data.TO_ENS && <div className="data-value">{data.TO_ENS}</div>}
                                <div className="data-value mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                    {data.TO_ADDRESS}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* INTERNAL TXS */}
                {data.HAS_INTERNAL_TXS && (
                    <div className="table-container">
                        <div className="section-title">Internal Execution / Smart Contract Trace</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '40%' }}>Caller</th>
                                    <th style={{ width: '40%' }}>Target</th>
                                    <th className="text-right" style={{ width: '20%' }}>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.INTERNAL_TXS.map((tx, idx) => (
                                    <tr key={idx}>
                                        <td><span className="font-mono text-secondary">{tx.fromShort}</span></td>
                                        <td><span className="font-mono text-secondary">{tx.toShort}</span></td>
                                        <td className="text-right">
                                            <span className="font-medium">{tx.amount} {tx.symbol}</span>
                                            {tx.isError && (
                                                <span className="direction-badge direction-out" style={{ marginLeft: '5px' }}>
                                                    FAIL
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* LINE ITEMS */}
                <div className="table-container">
                    <div className="section-title">Token Movements</div>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '10%' }}>Type</th>
                                <th style={{ width: '25%' }}>Asset</th>
                                <th style={{ width: '20%' }}>From</th>
                                <th style={{ width: '20%' }}>To</th>
                                <th className="text-right" style={{ width: '15%' }}>Amount</th>
                                <th className="text-right" style={{ width: '10%' }}>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.ITEMS.map((item, idx) => (
                                <tr key={idx}>
                                    <td>
                                        <span className={`direction-badge ${item.isIn ? 'direction-in' : 'direction-out'}`}>
                                            {item.isIn ? 'IN' : 'OUT'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="token-cell">
                                            {/* Assuming tokenIcon is text/emoji since template uses {{tokenIcon}} inside span */}
                                            <span>{item.tokenIcon}</span>
                                            <span className="font-medium">{item.tokenSymbol}</span>
                                        </div>
                                    </td>
                                    <td><span className="font-mono text-secondary">{item.fromShort}</span></td>
                                    <td><span className="font-mono text-secondary">{item.toShort}</span></td>
                                    <td className="text-right font-mono">{item.amountFormatted}</td>
                                    <td className={`text-right font-mono ${item.isIn ? 'amount-positive' : ''}`}>
                                        {item.usdValue}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* FINANCIAL SUMMARY & HISTORIC VALUE */}
                <div className="grid-2">
                    {/* Transaction Fees */}
                    <div className="summary-box" style={{ width: '100%' }}>
                        <div className="summary-row total" style={{ marginTop: 0, border: 'none', paddingTop: 0, marginBottom: '12px' }}>
                            Transaction Cost
                        </div>
                        <div className="summary-row">
                            <span className="text-secondary">Gas Price</span>
                            <span className="font-mono">{data.GAS_PRICE_GWEI} Gwei</span>
                        </div>
                        <div className="summary-row">
                            <span className="text-secondary">Gas Used</span>
                            <span className="font-mono">{data.GAS_USED}</span>
                        </div>
                        <div className="summary-row">
                            <span className="text-secondary">Total Fee</span>
                            <span className="font-mono">{data.TOTAL_FEE} {data.CHAIN_SYMBOL}</span>
                        </div>
                        <div className="summary-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)' }}>
                            <span className="font-medium">Cost in USD</span>
                            <span className="font-mono">${data.TOTAL_FEE_USD}</span>
                        </div>
                    </div>

                    {/* Historic Value */}
                    <div className="summary-box" style={{ width: '100%', border: '1px solid var(--color-accent-light)', background: '#fdfcff' }}>
                        <div className="summary-row total" style={{ marginTop: 0, border: 'none', paddingTop: 0, marginBottom: '12px', color: 'var(--color-accent-dark)' }}>
                            Historic Value (On Tx Date)
                        </div>
                        <div className="summary-row">
                            <span className="text-secondary">Total Received</span>
                            <span className="font-mono">${data.TOTAL_IN_USD}</span>
                        </div>
                        <div className="summary-row">
                            <span className="text-secondary">Total Sent</span>
                            <span className="font-mono">${data.TOTAL_OUT_USD}</span>
                        </div>
                        <div className="summary-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-accent-light)' }}>
                            <span className="font-medium">Net Change</span>
                            <span className={`font-mono ${data.NET_CHANGE_POSITIVE ? 'amount-positive' : 'amount-negative'}`}>
                                {data.NET_CHANGE_SIGN}${data.NET_CHANGE_USD}
                            </span>
                        </div>
                    </div>
                </div>

                {/* AUDIT */}
                {data.INCLUDE_AUDIT && (
                    <div className="audit-strip">
                        <div className="audit-title">Verification & Audit Trail</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                            <div className="data-group">
                                <div className="uppercase-label">Data Source</div>
                                <div className="data-value" style={{ fontSize: '11px' }}>{data.PRICE_SOURCE}</div>
                            </div>
                            <div className="data-group">
                                <div className="uppercase-label">AI Confidence</div>
                                <div className="data-value" style={{ fontSize: '11px' }}>{data.CONFIDENCE}%</div>
                            </div>
                            <div className="data-group">
                                <div className="uppercase-label">Method</div>
                                <div className="data-value" style={{ fontSize: '11px' }}>{data.CLASSIFICATION_METHOD}</div>
                            </div>
                            <div className="data-group">
                                <div className="uppercase-label">Reorg Check</div>
                                <div className="data-value" style={{ fontSize: '11px' }}>
                                    {data.REORG_DETECTED ? '⚠️ Detected' : '✅️ Passed'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '40px' }}></div>

                {/* FOOTER GROUP */}
                <div className="document-footer">
                    <div className="ad-container">
                        {data.hasAd ? (
                            <div dangerouslySetInnerHTML={{ __html: data.adContent }} />
                        ) : (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                                <strong>Promote your project here.</strong> Contact sarkaritoolmail@gmail.com
                            </div>
                        )}
                    </div>

                    <div className="qr-section">
                        <img src={data.QR_CODE_DATA_URL} className="qr-image" alt="QR Validation" />
                        <div style={{ textAlign: 'left' }}>
                            <div className="uppercase-label">Cryptographic Verification</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', maxWidth: '250px', marginTop: '4px' }}>
                                Scan to verify this transaction on-chain. Reference Bill #{data.BILL_ID}.
                            </div>
                        </div>
                    </div>

                    <div className="footer-legal">
                        <a href={data.FRONTEND_URL} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 'bold' }}>Generated by Chain Receipt</a>
                        {' • '}
                        <a href={data.EXPLORER_URL} style={{ color: 'var(--color-text-secondary)' }}>View on Explorer</a>
                        {' • '}
                        <a href={data.FRONTEND_URL} style={{ color: 'var(--color-text-secondary)' }}>Regenerate</a>
                        <br />
                        <span style={{ fontSize: '8px', color: '#cbd5e1', display: 'block', marginTop: '8px' }}>
                            <a href={data.DISCLAIMER_URL} style={{ color: 'var(--color-text-secondary)' }}>Disclaimer:</a>
                            {' '}
                            <span style={{ color: 'var(--color-text-secondary)' }}>This document is for informational purposes only. USD values are estimates at the time of transaction.
                                {' '}
                                Data is sourced directly from the {data.CHAIN_NAME} blockchain.
                                © {data.CURRENT_YEAR} Chain Receipt. </span>
                        </span>
                    </div>
                </div>
            </main>
        </div>
    );
}
