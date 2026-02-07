import { Endpoint } from "@/components/ui/Endpoint";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Tabs } from "@/components/ui/Tabs";
import { Metadata } from 'next';
import { constructCanonical, generateBreadcrumbSchema, generateTechArticleSchema } from "@/lib/seo";

export const metadata: Metadata = {
    title: 'API Reference',
    description: 'Complete technical reference for the TxProof API. Methods for receipt generation, webhooks, and usage monitoring.',
    alternates: {
        canonical: constructCanonical('/reference'),
    },
};

const breadcrumbs = [
    { name: "Docs", item: "/" },
    { name: "Reference", item: "/reference" },
];

const schema = generateTechArticleSchema(
    'TxProof API Reference',
    'Detailed technical specification of all TxProof API endpoints and payloads.',
    '/reference'
);

export default function Reference() {
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
                <h1 className="text-4xl font-bold tracking-tight">API Reference</h1>
                <p className="text-lg text-muted-foreground">
                    Complete reference for the TxProof API methods.
                    <br />Base URL: <code className="bg-muted px-2 py-1 rounded text-sm text-foreground">https://api.txproof.xyz</code>
                </p>
                <div className="flex gap-2 text-sm">
                    <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">Live v1</div>
                </div>
            </div>

            {/* --- RECEIPT GENERATION --- */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold border-b pb-2">Receipt Generation</h2>

                {/* POST /bills/resolve */}
                <Endpoint method="POST" path="/api/v1/bills/resolve">
                    <div className="space-y-6">
                        <p className="text-muted-foreground leading-relaxed">
                            Starts a background job to generate a receipt for a specific blockchain transaction.
                            This is an idempotent operation.
                        </p>

                        <div>
                            <h4 className="font-semibold text-sm uppercase text-foreground/70 mb-4 tracking-wider">Request Body</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-border pt-4">
                                <div className="md:col-span-1 font-mono text-sm text-primary font-semibold">txHash <span className="text-red-500">*</span></div>
                                <div className="md:col-span-1 text-sm text-muted-foreground font-mono">string</div>
                                <div className="md:col-span-2 text-sm text-muted-foreground">
                                    The transaction hash (0x...).
                                </div>

                                <div className="md:col-span-1 font-mono text-sm text-primary font-semibold">chainId <span className="text-red-500">*</span></div>
                                <div className="md:col-span-1 text-sm text-muted-foreground font-mono">number</div>
                                <div className="md:col-span-2 text-sm text-muted-foreground">
                                    The EVM chain ID (e.g. 1, 137, 8453).
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold text-sm uppercase text-foreground/70 mb-3 tracking-wider">Example</h4>
                            <CodeBlock language="bash" code={`curl -X POST https://api.txproof.xyz/api/v1/bills/resolve \\
  -H "X-API-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "txHash": "0x5d962...", "chainId": 1 }'`} />
                        </div>
                    </div>
                </Endpoint>

                {/* GET /bills/job/:jobId */}
                <Endpoint method="GET" path="/api/v1/bills/job/:jobId">
                    <div className="space-y-6">
                        <p className="text-muted-foreground leading-relaxed">
                            Poll status of a generation job.
                        </p>
                        <Tabs items={[
                            {
                                label: 'Response (Success)',
                                value: '200',
                                content: <CodeBlock language="json" code={`{
  "id": "job_123",
  "state": "completed",
  "data": { "billId": "bill-1-0x123..." },
  "pdfUrl": "https://storage.txproof.xyz/..."
}`} />
                            },
                            {
                                label: 'Response (Pending)',
                                value: 'pending',
                                content: <CodeBlock language="json" code={`{
  "id": "job_123",
  "state": "processing",
  "queuePosition": 2
}`} />
                            }
                        ]} />
                    </div>
                </Endpoint>
            </div>

            {/* --- WEBHOOKS --- */}
            <div className="space-y-6 pt-12">
                <h2 className="text-2xl font-bold border-b pb-2">Webhooks</h2>

                {/* POST /webhooks */}
                <Endpoint method="POST" path="/api/v1/webhooks">
                    <div className="space-y-6">
                        <p className="text-muted-foreground leading-relaxed">
                            Register a new webhook endpoint to receive real-time events.
                            <br /><strong>Note:</strong> Returns the signing secret only once.
                        </p>

                        <Tabs items={[
                            {
                                label: 'Request',
                                value: 'req',
                                content: <CodeBlock language="json" code={`{
  "url": "https://your-api.com/webhooks/txproof",
  "events": ["bill.created", "bill.failed"]
}`} />
                            },
                            {
                                label: 'Response',
                                value: 'res',
                                content: <CodeBlock language="json" code={`{
  "webhook": { "id": "wh_123", "url": "..." },
  "secret": "whsec_..." 
}`} />
                            }
                        ]} />
                    </div>
                </Endpoint>

                {/* GET /webhooks */}
                <Endpoint method="GET" path="/api/v1/webhooks">
                    <p className="text-muted-foreground">List all active webhooks.</p>
                </Endpoint>

                {/* DELETE /webhooks/:id */}
                <Endpoint method="DELETE" path="/api/v1/webhooks/:id">
                    <p className="text-muted-foreground">Delete a webhook subscription.</p>
                </Endpoint>

                {/* POST /webhooks/:id/rotate */}
                <Endpoint method="POST" path="/api/v1/webhooks/:id/rotate">
                    <div className="space-y-6">
                        <p className="text-muted-foreground leading-relaxed">
                            Rotates the signing secret for a webhook. This invalidates the old secret immediately.
                            <br /><strong>Note:</strong> Returns the new secret only once.
                        </p>
                        <Tabs items={[
                            {
                                label: 'Response',
                                value: 'res',
                                content: <CodeBlock language="json" code={`{
  "webhook": { 
    "id": "wh_123", 
    "url": "https://...", 
    "health_status": "active" 
  },
  "secret": "whsec_..." 
}`} />
                            }
                        ]} />
                    </div>
                </Endpoint>
            </div>


            {/* --- VERIFICATION --- */}
            <div className="space-y-6 pt-12">
                <h2 className="text-2xl font-bold border-b pb-2">Receipt Verification</h2>

                {/* POST /verify/receipt */}
                <Endpoint method="POST" path="/api/v1/verify/receipt">
                    <div className="space-y-6">
                        <p className="text-muted-foreground leading-relaxed">
                            Cryptographically verify a receipt's integrity against its stored hash in the database.
                        </p>

                        <div>
                            <h4 className="font-semibold text-sm uppercase text-foreground/70 mb-3 tracking-wider">Example Request</h4>
                            <CodeBlock language="bash" code={`curl -X POST https://api.txproof.xyz/api/v1/verify/receipt \\
  -H "Content-Type: application/json" \\
  -d '{ "billId": "550e8400-e29b-41d4-a716-446655440000" }'`} />
                        </div>

                        <div>
                            <h4 className="font-semibold text-sm uppercase text-foreground/70 mb-3 tracking-wider">Response</h4>
                            <CodeBlock language="json" code={`{
  "valid": true,
  "billId": "550e8400-e29b-41d4-a716-446655440000",
  "algorithm": "keccak256",
  "storedHash": "0xabc123...",
  "computedHash": "0xabc123...",
  "verified_at": "2024-03-20T10:00:00Z"
}`} />
                        </div>
                    </div>
                </Endpoint>
            </div>

            {/* --- USAGE --- */}
            <div className="space-y-6 pt-12">
                <h2 className="text-2xl font-bold border-b pb-2">Usage & Quotas</h2>

                {/* GET /usage */}
                <Endpoint method="GET" path="/api/v1/usage">
                    <div className="space-y-6">
                        <p className="text-muted-foreground leading-relaxed">
                            Get real-time usage metrics for the authenticated API key.
                        </p>
                        <CodeBlock language="json" code={`{
  "plan": {
    "name": "Professional",
    "limit": 50000,
    "rateLimitRps": 50
  },
  "usage": {
    "total": 12450,
    "remaining": 37550,
    "period": { "start": "2024-03-01...", "end": "..." }
  }
}`} />
                    </div>
                </Endpoint>
            </div>

        </div>
    )
}
