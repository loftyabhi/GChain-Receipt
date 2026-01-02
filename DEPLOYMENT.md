# Deployment & Infrastructure Guide

This guide outlines the infrastructure requirements and steps to deploy the Chain Receipt system in its Monorepo configuration.

## 1. Frontend (Vercel)

The frontend is a Next.js application located in `apps/web`.

-   **Platform**: Vercel
-   **Framework Preset**: Next.js
-   **Root Directory**: `apps/web`
    -   *Critical*: You MUST set the Root Directory in Vercel settings so it ignores the backend.
-   **Build Command**: `npm run build`
    -   (Vercel will automatically detect `cd ../.. && npm install` logic for monorepos).
-   **Environment Variables**:
    ```ini
    NEXT_PUBLIC_API_URL=https://your-api.onrender.com
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
    
    # Show Your Support System
    NEXT_PUBLIC_SUPPORT_VAULT_ADDRESS=0x...
    NEXT_PUBLIC_ADMIN_ADDRESS=0x...
    NEXT_PUBLIC_ALCHEMY_API_KEY=...  # Optional: For high-performance indexing
    ```

## 2. Backend (Render / Railway)

The backend is a Node.js/Express application located in `apps/api`.

-   **Platform**: Render (Web Service)
-   **Runtime**: Node
-   **Root Directory**: `.` (Repository Root)
    -   *Reason*: Render needs to see the root `package.json` to install workspace dependencies (`packages/*`).
-   **Build Command**:
    ```bash
    npm install && npm run build -w apps/api
    ```
-   **Start Command**:
    ```bash
    npm start -w apps/api
    ```
-   **Environment Variables** (Add to Render Dashboard):
    ```ini
    NODE_ENV=production
    PORT=3000
    DATABASE_URL=...
    REDIS_URL=...
    ALCHEMY_API_KEY=...
    PRIVATE_KEY=...
    ```

## 3. Database (Supabase)

-   **Schema Management**:
    -   Migrations are located in `packages/database/migrations`.
    -   Apply using Supabase CLI or copy SQL from `packages/database/migrations/schema.sql`.

## 4. Smart Contracts (Base Network)

-   **Location**: `packages/contracts`
-   **Deploy**:
    ```bash
    cd packages/contracts
    npx hardhat run scripts/deploy.ts --network base
    ```
-   **Update**: After deployment, update `packages/contracts/src/index.ts` with the new address and ABI.

## 5. Security Notes

-   **PDF Generation**: The API generates PDFs to `apps/api/public/bills`. Ensure your deployment platform supports ephemeral disk or configure S3 (Recommended for production).
-   **Secrets**: Never add `.env` files to `packages/*`. All secrets must be injected at the App level (`apps/web` or `apps/api`).

## 6. Wiring Services Together

This section explains how to connect your deployed services.

### A. Connect Database to Backend (Supabase -> Render)

1.  **Get Connection String**:
    *   Go to your **Supabase Dashboard** -> Project Settings -> Database.
    *   Find "Connection String" -> Select "Node.js" -> Copy the **Transaction Mode** (Pooler) string if available (port 6543), otherwise the Direct string (port 5432).
    *   *Note*: For serverless/cloud environments, the Transaction Pooler (port 6543) is recommended to prevent connection limit errors.
2.  **Set Variable in Render**:
    *   Go to your **Render Dashboard** -> Select your API Web Service -> Environment.
    *   Add/Update `DATABASE_URL` with the string you copied.
    *   *Important*: Replace `[YOUR-PASSWORD]` with your actual database password.

### B. Connect Backend to Frontend (Render -> Vercel)

1.  **Get Backend URL**:
    *   Go to your **Render Dashboard** -> Select your API Web Service.
    *   Copy the service URL (e.g., `https://chain-receipt-api.onrender.com`).
2.  **Set Variable in Vercel**:
    *   Go to your **Vercel Dashboard** -> Select your Project -> Settings -> Environment Variables.
    *   Add/Update `NEXT_PUBLIC_API_URL` with the Render URL.
    *   *Note*: Ensure there is NO trailing slash (e.g., correct: `.../api`, incorrect: `.../api/`).

### C. Web3 & External Services

1.  **WalletConnect (Reown)**:
    *   Go to [Reown Cloud](https://cloud.reown.com/) (formerly WalletConnect Cloud).
    *   Create a project and copy the **Project ID**.
    *   In **Vercel**, set `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`.
2.  **Alchemy (RPC)**:
    *   Go to [Alchemy Dashboard](https://dashboard.alchemy.com/).
    *   Create a new App (Base Mainnet).
    *   Copy the **API Key**.
    *   In **Vercel**, set `NEXT_PUBLIC_ALCHEMY_API_KEY`.
    *   In **Render**, set `ALCHEMY_API_KEY`.

### D. Final Check

1.  **Redeploy Backend**: If you changed Render variables, go to "Manual Deploy" -> "Deploy latest commit" to ensure new variables are picked up.
2.  **Redeploy Frontend**: If you changed Vercel variables, go to "Deployments" -> Redeploy your latest build.

