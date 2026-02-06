/**
 * Hybrid Authentication Middleware (STRICT MODE)
 * 
 * PREVIOUSLY: Allowed downgrade to public rate limiting if no key was present.
 * STRICT UPDATE: DOWNGRADE REMOVED.
 * 
 * All traffic reaching this middleware MUST be authenticated via strict SaaS rules.
 * We simply alias to saasMiddleware now to enforce the "Strict Key" invariant.
 * 
 * Keeping the file to avoid breaking imports, but behavior is now STRICT.
 */
import { saasMiddleware } from './saasAuth';

export const hybridAuth = saasMiddleware;
export const hybridAuthWithTracking = saasMiddleware;
