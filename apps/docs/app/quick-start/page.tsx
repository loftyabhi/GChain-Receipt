import { CodeBlock } from "@/components/ui/CodeBlock";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Metadata } from 'next';
import { constructCanonical, generateBreadcrumbSchema, generateTechArticleSchema } from "@/lib/seo";

export const metadata: Metadata = {
    title: 'Quick Start',
    description: 'Get started with the TxProof API in minutes. Learn how to submit receipt requests and poll for completion.',
    alternates: {
        canonical: constructCanonical('/quick-start'),
    },
};

const breadcrumbs = [
    { name: "Docs", item: "/" },
    { name: "Quick Start", item: "/quick-start" },
];

const schema = generateTechArticleSchema(
    'Quick Start Guide - TxProof API',
    'Step-by-step guide to generating your first verifiable blockchain receipt.',
    '/quick-start'
);

export default function QuickStart() {
    const jsExample = `
// 1. Submit Receipt Request
const res = await fetch('https://api.txproof.xyz/api/v1/bills/resolve', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': 'sk_live_...' // Optional for public, required for higher limits
  },
  body: JSON.stringify({
    txHash: '0x51c68f2c3d5e2d6b3a3c754630a969f6e4a2c070', // Example Base Tx
    chainId: 8453
  })
});

const { jobId } = await res.json();
console.log("Job Started:", jobId);

// 2. Poll for Status
const poll = async (id) => {
  const statusRes = await fetch(\`https://api.txproof.xyz/api/v1/bills/job/\${id}\`);
  const data = await statusRes.json();
  
  if (data.state === 'completed') {
    console.log("PDF Ready:", data.pdfUrl);
    console.log("Bill Data:", data.data);
  } else if (data.state === 'failed') {
    console.error("Job Failed:", data.error);
  } else {
    // Retry after 2s
    console.log("Status:", data.state, "Queue Pos:", data.queuePosition);
    setTimeout(() => poll(id), 2000);
  }
};

poll(jobId);
`;

    const curlExample = `
# 1. Start Job
curl -X POST https://api.txproof.xyz/api/v1/bills/resolve \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_..." \\
  -d '{
    "txHash": "0x51c68f2c3d5e2d6b3a3c754630a969f6e4a2c070",
    "chainId": 8453
  }'

# Response: { "jobId": "job_123", "state": "pending" }

# 2. Poll Status (Repeat until completed)
curl https://api.txproof.xyz/api/v1/bills/job/job_123

# Response (Completed):
# {
#   "state": "completed",
#   "pdfUrl": "https://storage.supabase.co/...",
#   "data": { ... }
# }
`;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbSchema(breadcrumbs)) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Quick Start</h1>
                <p className="text-lg text-muted-foreground">
                    Generate your first receipt in under 5 minutes.
                </p>
            </div>

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">1. Start a Job</h2>
                <p className="text-muted-foreground">
                    Submit the transaction hash and chain ID you want to generate a receipt for.
                </p>

                <Tabs
                    items={[
                        {
                            label: 'JavaScript',
                            value: 'js',
                            content: <CodeBlock language="javascript" code={jsExample} filename="client.js" />
                        },
                        {
                            label: 'cURL',
                            value: 'curl',
                            content: <CodeBlock language="bash" code={curlExample} filename="terminal" />
                        }
                    ]}
                />
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">2. Understand Responses</h2>
                <p className="text-muted-foreground">
                    The API will return a job status. You should handle all states:
                </p>
                <div className="grid gap-2">
                    <div className="flex items-center gap-2 text-sm p-3 border border-border rounded-lg bg-card">
                        <StatusBadge status="pending" />
                        <span className="text-muted-foreground">Job accepted, waiting in queue.</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm p-3 border border-border rounded-lg bg-card">
                        <StatusBadge status="processing" />
                        <span className="text-muted-foreground">Worker is fetching data and generating PDF.</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm p-3 border border-primary/20 rounded-lg bg-primary/5">
                        <StatusBadge status="completed" />
                        <span className="text-foreground font-medium">Success! Response contains `pdfUrl` and `metadata`.</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm p-3 border border-border rounded-lg bg-card">
                        <StatusBadge status="failed" />
                        <span className="text-destructive">Error triggered. Check `error` field in response.</span>
                    </div>
                </div>
            </section>
        </div>
    );
}
