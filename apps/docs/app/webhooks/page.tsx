
import { Endpoint } from "@/components/ui/Endpoint";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Tabs } from "@/components/ui/Tabs";
import { Metadata } from 'next';
import { constructCanonical, generateBreadcrumbSchema, generateTechArticleSchema } from "@/lib/seo";

export const metadata: Metadata = {
    title: 'Webhooks',
    description: 'Securely receive real-time events from TxProof using webhooks. Learn how to verify signatures, handle retries, and process events.',
    alternates: {
        canonical: constructCanonical('/webhooks'),
    },
};

const breadcrumbs = [
    { name: "Docs", item: "/" },
    { name: "Webhooks", item: "/webhooks" },
];

const schema = generateTechArticleSchema(
    'TxProof Webhooks',
    'Guide to implementing and securing webhooks for real-time transaction updates.',
    '/webhooks'
);

export default function Webhooks() {
    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />

            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Webhooks</h1>
                <p className="text-lg text-muted-foreground">
                    Listen for real-time events from TxProof to automate your workflow.
                    Webhooks allow your system to receive instant notifications when receipts are generated or transactions are processed.
                </p>
                <div className="flex gap-2 text-sm">
                    <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">HTTPS Only</div>
                    <div className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">HMAC-SHA256 Signed</div>
                </div>
            </div>

            {/* --- OVERVIEW --- */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold border-b pb-2">Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Features</h3>
                        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                            <li><strong>Real-time Usage:</strong> Receive events as they happen, no polling required.</li>
                            <li><strong>Secure:</strong> All payloads are signed with HMAC-SHA256 using your unique secret.</li>
                            <li><strong>Resilient:</strong> Automatic retries with exponential backoff for failed delivery attempts.</li>
                            <li><strong>Idempotent:</strong> Unique Event IDs prevent duplicate processing.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* --- EVENTS --- */}
            <div className="space-y-6 pt-6">
                <h2 className="text-2xl font-bold border-b pb-2">Event Types</h2>
                <p className="text-muted-foreground">
                    We currently support the following event types:
                </p>

                <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr className="border-b">
                                <th className="px-4 py-3 text-left w-1/3">Event Type</th>
                                <th className="px-4 py-3 text-left">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            <tr>
                                <td className="px-4 py-3 font-mono text-primary">bill.completed</td>
                                <td className="px-4 py-3 text-muted-foreground">Triggered when a receipt generation job completes successfully.</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-mono text-primary">bill.failed</td>
                                <td className="px-4 py-3 text-muted-foreground">Triggered when a receipt generation fails (e.g. invalid transaction).</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- PAYLOAD STRUCTURE --- */}
            <div className="space-y-6 pt-6">
                <h2 className="text-2xl font-bold border-b pb-2">Payload Structure</h2>
                <p className="text-muted-foreground">
                    All webhook events share a common structure. The <code>data</code> field contains the resource-specific information.
                </p>
                <CodeBlock language="json" code={`{
  "event_type": "bill.completed",
  "id": "evt_bill_test_123456_bill.completed",
  "data": {
    "bill_id": "bill_123456",
    "transaction_hash": "0x5d962...",
    "chain_id": 8453,
    "status": "completed",
    "amount": "1000000000000000000",
    "currency": "ETH", 
    "pdf_url": "https://storage.txproof.xyz/receipts/..."
  },
  "txHash": "0x5d962...",
  "timestamp": 1716300000
}`} />
            </div>

            {/* --- SECURITY --- */}
            <div className="space-y-6 pt-6">
                <h2 className="text-2xl font-bold border-b pb-2">Security & Verification</h2>
                <p className="text-muted-foreground">
                    TxProof signs all webhook events so you can verify they were sent by us.
                    The signature is included in the <code>X-TxProof-Signature</code> header.
                </p>

                <div className="p-4 bg-muted/30 border rounded-lg space-y-4">
                    <h3 className="font-semibold">Verification Strategy</h3>
                    <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                        <li>Extract the <code>t</code> (timestamp) and <code>v1</code> (signature) from the <code>X-TxProof-Signature</code> header.</li>
                        <li>Verify that the timestamp is recent (e.g., within 5 minutes) to prevent replay attacks.</li>
                        <li>Canonicalize the JSON payload (we recommend using <code className="bg-muted px-1 rounded">canonicalize</code> or similar RFC 8785 compliant library).</li>
                        <li>Construct the signed content string: <code>{"{timestamp}.{canonical_payload}"}</code>.</li>
                        <li>Compute an HMAC-SHA256 hash using your webhook signing secret.</li>
                        <li>Compare your computed signature with the provided <code>v1</code> signature using a constant-time comparison.</li>
                    </ol>
                </div>

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Node.js Example</h4>
                    <CodeBlock language="javascript" code={`const crypto = require('crypto');
const canonicalize = require('canonicalize'); // npm install canonicalize

function verifyWebhook(payload, header, secret) {
    // 1. Parse valid header format: t={timestamp},v1={signature}
    const parts = header.split(',');
    const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
    const signature = parts.find(p => p.startsWith('v1=')).split('=')[1];

    // 2. Prevent Replay Attacks (5 min tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
        throw new Error('Timestamp out of tollerance');
    }

    // 3. Create Canonical String
    const canonicalPayload = canonicalize(payload);
    const signedContent = \`\${timestamp}.\${canonicalPayload}\`;

    // 4. Compute Expected Signature
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('hex');

    // 5. Constant-Time Comparison
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}`} />
                </div>
            </div>

            {/* --- RETRY POLICY --- */}
            <div className="space-y-6 pt-6">
                <h2 className="text-2xl font-bold border-b pb-2">Retry Policy</h2>
                <p className="text-muted-foreground">
                    If your server fails to respond with a 2xx status code within 5 seconds, we will attempt to redeliver the event.
                    We use an exponential backoff strategy for retries.
                </p>

                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { attempt: 1, wait: 'Immediate' },
                        { attempt: 2, wait: '1 second' },
                        { attempt: 3, wait: '2 seconds' },
                        { attempt: 4, wait: '4 seconds' },
                        { attempt: 5, wait: '8 seconds' },
                        { attempt: 6, wait: '16 seconds' },
                    ].map((retry) => (
                        <li key={retry.attempt} className="border p-3 rounded text-center">
                            <div className="text-xs text-muted-foreground uppercase mb-1">Attempt {retry.attempt}</div>
                            <div className="font-semibold">{retry.wait}</div>
                        </li>
                    ))}
                </ul>

                <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded">
                    After 5 failed retries (total 6 attempts), the event will be marked as <strong>failed</strong> and will not be retried automatically.
                </p>
            </div>

            {/* --- BEST PRACTICES --- */}
            <div className="space-y-6 pt-6">
                <h2 className="text-2xl font-bold border-b pb-2">Best Practices</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                    <ul className="space-y-2">
                        <li>
                            <strong className="text-foreground">Process Asynchronously:</strong>
                            Your endpoint should return a 200 OK response immediately upon receiving the event, before processing complex logic. This prevents timeouts.
                        </li>
                        <li>
                            <strong className="text-foreground">Idempotency is Key:</strong>
                            Though we aim for exactly-once delivery, network failures can result in duplicate deliveries. Always check the <code>id</code> field to key your processing logic.
                        </li>
                        <li>
                            <strong className="text-foreground">Verify Signatures:</strong>
                            Never trust the payload content blindly. Always verify the signature to ensure the request originated from TxProof.
                        </li>
                        <li>
                            <strong className="text-foreground">Use HTTPS:</strong>
                            Your webhook URL must accept HTTPS connections to ensure payload privacy and security.
                        </li>
                    </ul>
                </div>
            </div>

        </div>
    )
}
