import { CodeBlock } from "@/components/ui/CodeBlock";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function QuickStart() {
    const jsExample = `
// 1. Submit Receipt Request
const res = await fetch('https://api.txproof.xyz/api/v1/bills/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    txHash: '0x123...', // Replace with actual Tx Hash
    chainId: 1         // 1 = Mainnet, 137 = Polygon, etc.
  })
});

const { jobId } = await res.json();
console.log("Job Started:", jobId);

// 2. Poll for Status
const poll = async (id) => {
  const statusRes = await fetch(\`https://api.txproof.xyz/api/v1/bills/job/\${id}\`);
  const data = await statusRes.json();
  
  if (data.status === 'completed') {
    console.log("PDF Ready:", data.data.pdfUrl);
    console.log("Metadata:", data.data.bill);
  } else if (data.status === 'failed') {
    console.error("Job Failed:", data.error);
  } else {
    // Retry after 2s
    console.log("Status:", data.status);
    setTimeout(() => poll(id), 2000);
  }
};

poll(jobId);
`;

    const curlExample = `
# 1. Start Job
curl -X POST https://api.txproof.xyz/api/v1/bills/resolve \\
  -H "Content-Type: application/json" \\
  -d '{"txHash": "0xc75...", "chainId": 1}'

# Response: { "jobId": "job_123", "status": "pending" }

# 2. Poll Status (Repeat until completed)
curl https://api.txproof.xyz/api/v1/bills/job/job_123

# Response (Completed):
# {
#   "status": "completed",
#   "data": {
#     "pdfUrl": "https://...",
#     "bill": { ... }
#   }
# }
`;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
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
