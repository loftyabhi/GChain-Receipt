# Contributing to Chain Receipt

Thank you for your interest in contributing! This project is a **Monorepo** managed by npm workspaces.

## Development Setup

### 1. Installation

We use the root `package.json` to manage dependencies for all apps and packages.

```bash
# Install everything
npm install
```

### 2. Project Structure

-   `apps/web`: Next.js Frontend.
-   `apps/api`: Express Backend.
-   `packages/contracts`: Smart Contracts & ABIs.
-   `packages/domain`: Shared TypeScript interfaces.
-   `packages/database`: SQL Schema & Seeds.
-   `tools/`: Verification scripts.

### 3. Running Locally

**Start Everything:**
```bash
npm run dev
```

**Start Specific App:**
```bash
npm run dev -w apps/web
# OR
npm run dev -w apps/api
```

### 4. Working with Shared Packages

If you modify a shared package (e.g., `packages/domain`):
1.  Make your changes in `packages/domain/src`.
2.  The changes are immediately available to apps (via TypeScript path mapping/symlinks).
3.  If you add a new dependency to a package, run `npm install` at the root.

### 5. PDF Generation

The PDF engine has been migrated to a **Client-Side** architecture.
-   **Backend**: `apps/api` handles data fetching and caching (Soft Queue).
-   **Frontend**: `apps/web/src/app/print/bill/[id]` handles the actual rendering.
-   **Templates**: Located in `apps/api/templates`.
-   **Verification**: Run `npx ts-node tools/verification/verify_bill_service_v2.ts` to test PDF generation without running the full server.

## Code Style

-   **Strict Boundaries**:
    -   Common types -> `packages/domain`
    -   Frontend code -> `apps/web` (Never import from `api`)
    -   Backend code -> `apps/api`
-   **Secrets**: Use `.env` files in App directories only.
