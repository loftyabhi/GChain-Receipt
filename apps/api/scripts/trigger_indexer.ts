
const API_URL = process.env.API_URL || "https://gchain-receipt.onrender.com";

async function main() {
    console.log(`[Cron] Triggering Indexer at ${API_URL}...`);
    try {
        const res = await fetch(`${API_URL}/api/v1/indexer/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: false }) // Respect locks, don't force unless manual
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API responded with ${res.status}: ${err}`);
        }

        const data = await res.json();
        console.log("[Cron] Success:", data);

    } catch (error: any) {
        console.error("[Cron] Failed:", error.message);
        process.exit(1);
    }
}

main();
