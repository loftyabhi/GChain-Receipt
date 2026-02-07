
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

                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-700 rounded-lg space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="text-2xl">⚠️</div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-red-900 dark:text-red-200">Critical: Use Raw Request Body</h3>
                            <p className="text-sm text-red-800 dark:text-red-300">
                                You <strong>MUST</strong> use the raw request body bytes for signature verification.
                                Do NOT parse the JSON first and then re-canonicalize it — this will fail because
                                JSON parsing is not reversible.
                            </p>
                            <div className="text-sm text-red-800 dark:text-red-300 space-y-1">
                                <div className="font-semibold">❌ Wrong (will fail):</div>
                                <code className="block bg-red-100 dark:bg-red-900/40 p-2 rounded text-xs">
                                    const payload = JSON.parse(body);<br />
                                    const canonical = canonicalize(payload); // ❌ Doesn't match original
                                </code>
                                <div className="font-semibold mt-2">✅ Correct:</div>
                                <code className="block bg-green-100 dark:bg-green-900/40 p-2 rounded text-xs">
                                    const rawBody = req.body.toString('utf8'); // ✅ Use raw bytes
                                </code>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-muted/30 border rounded-lg space-y-4">
                    <h3 className="font-semibold">Verification Strategy</h3>
                    <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                        <li><strong>Access the raw request body</strong> BEFORE any JSON parsing middleware processes it.</li>
                        <li>Extract the <code>t</code> (timestamp) and <code>v1</code> (signature) from the <code>X-TxProof-Signature</code> header.</li>
                        <li>Verify that the timestamp is recent (e.g., within 5 minutes) to prevent replay attacks.</li>
                        <li>Construct the signed content string: <code>{"{timestamp}.{raw_body_string}"}</code>.</li>
                        <li>Compute an HMAC-SHA256 hash using your webhook signing secret.</li>
                        <li>Compare your computed signature with the provided <code>v1</code> signature using a constant-time comparison.</li>
                        <li>Only THEN parse the JSON for processing.</li>
                    </ol>
                </div>

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Express.js Example (Recommended)</h4>
                    <CodeBlock language="javascript" code={`const express = require('express');
const crypto = require('crypto');

const app = express();

// CRITICAL: Use express.raw() to preserve the raw body bytes
app.post('/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const rawBody = req.body.toString('utf8'); // Get raw JSON string
    const signatureHeader = req.headers['x-txproof-signature'];
    const secret = process.env.TXPROOF_WEBHOOK_SECRET;

    // 1. Parse signature header format: t={timestamp},v1={signature}
    const parts = signatureHeader.split(',');
    const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
    const receivedSignature = parts.find(p => p.startsWith('v1=')).split('=')[1];

    // 2. Check timestamp freshness (5 minute tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return res.status(401).json({ error: 'Timestamp expired' });
    }

    // 3. Construct signed content using RAW body
    const signedContent = \`\${timestamp}.\${rawBody}\`;

    // 4. Compute expected signature
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    // 5. Constant-time comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(computedSignature)
    )) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // ✅ Signature verified! NOW parse the JSON
    const payload = JSON.parse(rawBody);

    // Process the webhook event...
    console.log('Received event:', payload.event_type);

    res.json({ received: true });
  }
);`} />
                </div>

                {/* Quick Copy-Paste Utility */}
                <div className="space-y-2 mt-6">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Quick Start: Drop-in Verification Function</h4>
                        <div className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">Copy & Paste Ready</div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Production-ready verification utility you can drop into any Node.js/Express project:
                    </p>
                    <CodeBlock language="javascript" code={`// webhook-verifier.js - Place this in your utils folder
const crypto = require('crypto');

/**
 * Verify TxProof webhook signature
 * @param {string} rawBody - Raw request body as string (MUST be raw, not parsed)
 * @param {string} signatureHeader - Value of X-TxProof-Signature header
 * @param {string} secret - Your webhook signing secret
 * @param {number} toleranceSeconds - Timestamp tolerance (default: 300)
 * @returns {{valid: boolean, error?: string, payload?: object}}
 */
function verifyTxProofWebhook(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  try {
    // 1. Parse signature header
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return { valid: false, error: 'Invalid signature header format' };
    }

    const timestamp = parseInt(timestampPart.split('=')[1]);
    const receivedSignature = signaturePart.split('=')[1];

    // 2. Check timestamp freshness
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return { valid: false, error: 'Timestamp expired (possible replay attack)' };
    }

    // 3. Compute expected signature
    const signedContent = \`\${timestamp}.\${rawBody}\`;
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    // 4. Constant-time comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(computedSignature)
    )) {
      return { valid: false, error: 'Signature mismatch' };
    }

    // 5. Parse and return payload
    const payload = JSON.parse(rawBody);
    return { valid: true, payload };

  } catch (error) {
    return { valid: false, error: error.message };
  }
}

module.exports = { verifyTxProofWebhook };

// --- USAGE EXAMPLE ---
// const express = require('express');
// const { verifyTxProofWebhook } = require('./utils/webhook-verifier');
//
// app.post('/webhook',
//   express.raw({ type: 'application/json' }),
//   (req, res) => {
//     const result = verifyTxProofWebhook(
//       req.body.toString('utf8'),
//       req.headers['x-txproof-signature'],
//       process.env.TXPROOF_WEBHOOK_SECRET
//     );
//
//     if (!result.valid) {
//       return res.status(401).json({ error: result.error });
//     }
//
//     // ✅ Verified! Process the webhook
//     console.log('Event:', result.payload.event_type);
//     res.json({ received: true });
//   }
// );`} />
                </div>

                <div className="space-y-2 mt-4">
                    <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Next.js API Routes Example</h4>
                    <CodeBlock language="javascript" code={`// pages/api/webhook.js (Pages Router)
// OR app/api/webhook/route.js (App Router)

import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // CRITICAL: Disable automatic parsing
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read raw body
  const rawBody = await new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { resolve(data); });
  });

  const signatureHeader = req.headers['x-txproof-signature'];
  const secret = process.env.TXPROOF_WEBHOOK_SECRET;

  // Parse signature header
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
  const receivedSignature = parts.find(p => p.startsWith('v1=')).split('=')[1];

  // Verify timestamp
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return res.status(401).json({ error: 'Timestamp expired' });
  }

  // Verify signature
  const signedContent = \`\${timestamp}.\${rawBody}\`;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(computedSignature)
  )) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse JSON after verification
  const payload = JSON.parse(rawBody);

  // Process webhook...
  console.log('Event received:', payload.event_type);

  res.json({ received: true });
}`} />
                </div>
            </div>

            {/* --- TROUBLESHOOTING --- */}
            <div className="space-y-6 pt-6">
                <h2 className="text-2xl font-bold border-b pb-2">Troubleshooting</h2>

                <div className="space-y-4">
                    <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-2">
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">❌ Problem: "Signatures don't match"</h3>
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            This is almost always caused by using a parsed JSON object instead of the raw request body.
                        </p>
                        <div className="text-sm text-yellow-800 dark:text-yellow-300">
                            <strong>Solution:</strong>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>Verify you're using <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">express.raw()</code> or equivalent</li>
                                <li>Check that you're NOT calling <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">JSON.parse()</code> before verification</li>
                                <li>Ensure you're accessing <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">req.body.toString('utf8')</code> for the raw string</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-2">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-200">💡 Debugging Tips</h3>
                        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                            <p><strong>Log these values to debug:</strong></p>
                            <CodeBlock language="javascript" code={`console.log('Raw Body Length:', rawBody.length);
console.log('Timestamp:', timestamp);
console.log('Received Signature:', receivedSignature);
console.log('Computed Signature:', computedSignature);
console.log('Secret Length:', secret.length); // Should be 70 chars (whsec_ + 64 hex)`} />
                            <p className="mt-2">
                                If your computed signature doesn't match, verify your webhook secret is correct.
                                The secret should start with <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">whsec_</code>
                                and be 70 characters long.
                            </p>
                        </div>
                    </div>
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
