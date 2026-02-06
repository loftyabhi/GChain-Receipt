import { Request, Response, NextFunction } from 'express';

/**
 * Quota Enforcement Middleware (DEPRECATED functionality)
 * 
 * Strict Architecture Update:
 * Quota enforcement is now centralized in `saasMiddleware`.
 * This file now only provides `gateFeature`.
 */

export const enforceQuota = (req: Request, res: Response, next: NextFunction) => {
    // PASS-THROUGH
    // Quota is already checked in saasMiddleware.
    next();
};

/**
 * Feature Gating Factory
 * Checks if the current authenticated context allows a feature.
 */
export const gateFeature = (featureFlag: 'allows_webhooks' | 'allows_branding' | 'allows_bulk') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const auth = (req as any).auth; // Populated by saasMiddleware

        if (!auth) {
            // Internal users (System Key) usually have all features, 
            // OR we block feature-gated routes for internal if not applicable.
            // For now, if no 'auth' object (public context), we block.
            // If internal (user context), we might pass or fail based on policy.
            // Let's assume features are for API Plans.

            // If internal user, maybe allow?
            if ((req as any).user) return next();

            return res.status(403).json({ error: 'Feature gating requires valid API Key context' });
        }

        if (auth.plan && !auth.plan[featureFlag]) {
            return res.status(403).json({
                error: 'Feature not included in your plan',
                feature: featureFlag,
                upgrade_url: '/console/upgrade'
            });
        }

        next();
    };
};
