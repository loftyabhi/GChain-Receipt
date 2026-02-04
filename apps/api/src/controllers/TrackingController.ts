import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export class TrackingController {

    /**
     * Handle 1x1 pixel request for open tracking
     */
    static async trackOpen(req: Request, res: Response) {
        const { jobId } = req.params;

        if (jobId) {
            try {
                // Fire and forget update
                supabase.from('email_jobs')
                    .update({ opened_at: new Date().toISOString() })
                    .eq('id', jobId)
                    .then(({ error }) => {
                        if (error) logger.error('Failed to track email open', error);
                        else logger.info('Email opened', { jobId });
                    });
            } catch (e) {
                logger.error('Error in trackOpen', e);
            }
        }

        // Return 1x1 transparent GIF
        const img = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': img.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });
        res.end(img);
    }

    /**
     * Handle link click wrapping
     */
    static async trackClick(req: Request, res: Response) {
        const { jobId } = req.params;
        const { url } = req.query;

        if (!url || typeof url !== 'string') {
            res.status(400).send('Invalid URL');
            return;
        }

        if (jobId) {
            try {
                supabase.from('email_jobs')
                    .update({ clicked_at: new Date().toISOString() })
                    .eq('id', jobId)
                    .then(({ error }) => {
                        if (error) logger.error('Failed to track email click', error);
                        else logger.info('Email clicked', { jobId, url });
                    });
            } catch (e) {
                logger.error('Error in trackClick', e);
            }
        }

        res.redirect(url);
    }
}
