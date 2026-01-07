# Bill Generation Architecture (Client-Side)

## 1. Overview
The Bill Generation system has been migrated from a server-side Puppeteer architecture to a high-fidelity client-side browser-native workflow. This ensures pixel-perfect rendering, reduces server infrastructure costs, and eliminates brittle PDF generation dependencies.

## 2. Architecture

### Frontend (Next.js)
*   **Route**: `/print/bill/[billId]`
*   **Component**: [`BillPrintPage`](../apps/web/src/app/print/bill/[billId]/page.tsx)
*   **Styling**: Dedicated `print.css` with `@media print` rules.
*   **Logic**:
    1.  Fetches `BillViewModel` JSON from API.
    2.  Renders HTML/React components matching the original template.
    3.  Waits for resources (Fonts, Images) to load.
    4.  Triggers `window.print()` automatically.

### Backend (Node.js/Express)
*   **Endpoint**: `GET /api/v1/bills/:billId/data`
*   **Duties**:
    1.  Checks Supabase Storage for existing Bill JSON.
    2.  If missing, triggers **Soft Queue** Job (Idempotent).
    3.  **Soft Queue Worker**:
        *   Claims job atomically via DB RPC.
        *   Fetches Chain Receipt data (with concurrency limits).
        *   Constructs ViewModel.
        *   Uploads JSON to Storage (Cache).
    4.  Returns JSON to Frontend.
    *   **NO** PDF rendering happens here.

## 3. Key Features
*   **Browser-Native Printing**: Uses the user's browser engine (Chromium/Gecko/WebKit) for vector-quality text and layout.
*   **Self-Hosting Fonts**: Inter and JetBrains Mono are loaded directly to ensure consistency.
*   **Deterministic Layout**:
    *   `break-inside: avoid` prevents tables/sections from splitting awkwardly.
    *   Page margins set via `@page` CSS.
    *   Headers/Footers rendered by browser (Chrome/Edge support custom headers via titles).

## 4. Browser Compatibility
| Browser | Support Level | Notes |
| :--- | :--- | :--- |
| **Chrome / Edge / Brave** | ✅ **Tier 1** | Full support. Consistent headers, footers, and margins. |
| **Firefox** | ⚠️ Tier 2 | Good layout. Page numbers/headers may require manual print dialog settings. |
| **Safari** | ⚠️ Tier 2 | Good layout. Headers/footers often stripped by default. |

## 5. Troubleshooting
*   **"Legacy Print Mode" Banner**: If you see this in the output, ensure your print settings (margins, scale) are default. This banner is designed to be hidden via CSS.
*   **Missing Background Colors**: Enable "Background Graphics" in the print dialog.
*   **Timeout / Blank Page**: The print trigger waits for `document.fonts.ready`. If fonts fail to load, it falls back to print after a short delay.
