# TxProof API Reference

## Authentication
All API requests require an API Key. You can obtain one from the [Developer Dashboard](https://txproof.xyz/dashboard).

Include the key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: sk_live_..." https://api.txproof.xyz/v1/...
```

---

## 1. Generate Receipt
Trigger the generation of a cryptographic receipt for a blockchain transaction.

**Endpoint**: `POST /api/v1/bills/resolve`

### Request Body
| Field | Type | Description |
|---|---|---|
| `txHash` | string | The transaction hash (0x...) |
| `chainId` | number | The blockchain Chain ID (e.g. 8453 for Base) |

### Example Request
```bash
curl -X POST https://api.txproof.xyz/api/v1/bills/resolve \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0x51c68f2c3d5e...",
    "chainId": 8453
  }'
```

### Response (200 OK)
```json
{
  "success": true,
  "jobId": "job_12345...",
  "status": "pending",
  "message": "Request queued"
}
```

---

## 2. Check Job Status
Poll the status of a receipt generation job.

**Endpoint**: `GET /api/v1/bills/job/:jobId`

### Example Request
```bash
curl -H "X-API-Key: YOUR_API_KEY" https://api.txproof.xyz/api/v1/bills/job/job_12345
```

### Response (200 OK)
```json
{
  "id": "job_12345",
  "state": "completed",
  "data": { "billId": "BILL-8453-..." },
  "pdfUrl": "https://...",
  "queuePosition": 0
}
```

---

## 3. Verify Receipt Integrity
Cryptographically verify that a receipt JSON matches its stored hash.

**Endpoint**: `POST /api/v1/verify/receipt`

### Request Body
| Field | Type | Description |
|---|---|---|
| `billId` | string | The UUID or Bill ID to verify |

### Example Request
```bash
curl -X POST https://api.txproof.xyz/api/v1/verify/receipt \
  -H "Content-Type: application/json" \
  -d '{ "billId": "550e8400-e29b-41d4-a716-446655440000" }'
```

### Response
```json
{
  "valid": true,
  "billId": "550e8400...",
  "algorithm": "keccak256",
  "verified_at": "2024-02-05T12:00:00Z"
}
```
