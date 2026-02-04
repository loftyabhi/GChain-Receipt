import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

export interface IEmailOptions {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface IEmailProvider {
    send(mailOptions: IEmailOptions): Promise<void>;
}

export class NodemailerProvider implements IEmailProvider {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465, // Implicit TLS
            secure: true,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS
            },
            // Aggressive Fail-Fast Timeouts
            connectionTimeout: 10000, // 10s wait for connection
            greetingTimeout: 5000,    // 5s wait for greeting
            socketTimeout: 20000      // 20s inactive socket
        });
    }

    async send(mailOptions: IEmailOptions) {
        await this.transporter.sendMail(mailOptions);
    }
}

export class EmailService {
    constructor(private provider: IEmailProvider = new NodemailerProvider()) { }

    private getBaseTemplate(): { html: string; text: string } {
        const templatesDir = path.join(__dirname, 'email/templates');
        try {
            return {
                html: fs.readFileSync(path.join(templatesDir, 'base.html'), 'utf-8'),
                text: '{{content}}' // Simple fallback
            };
        } catch (e) {
            // Fallback if file system fails (e.g. serverless environment issue)
            logger.warn('Could not load base.html', e);
            return {
                html: '<html><body>{{content}}</body></html>',
                text: '{{content}}'
            };
        }
    }

    /**
     * Renders a template by injecting content into the base theme and replacing variables.
     * @param contentHtml The specific email body content (HTML)
     * @param contentText The specific email body content (Text)
     * @param data Variables to replace (e.g. {{name}})
     */
    public render(contentHtml: string, contentText: string, data: Record<string, string>): { html: string; text: string } {
        const base = this.getBaseTemplate();

        // Inject content into base
        let html = base.html.replace('{{content}}', contentHtml);
        let text = contentText; // Text version usually doesn't have a wrapper, or we can prepend header/footer

        // Populate variables
        const allData = {
            ...data,
            year: new Date().getFullYear().toString()
        };

        for (const [key, value] of Object.entries(allData)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, value || '');
            text = text.replace(regex, value || '');
        }

        return { html, text };
    }

    /**
     * Legacy helper to load from file system
     */
    private renderFileTemplate(templateName: string, data: Record<string, string>): { html: string; text: string } {
        const templatesDir = path.join(__dirname, 'email/templates');
        const contentHtmlPath = path.join(templatesDir, `${templateName}.html`);
        const contentTextPath = path.join(templatesDir, `${templateName}.txt`);

        let contentHtml = '';
        let contentText = '';

        try {
            contentHtml = fs.readFileSync(contentHtmlPath, 'utf-8');
            contentText = fs.readFileSync(contentTextPath, 'utf-8');
        } catch (e) {
            logger.error(`Template file not found: ${templateName}`, e);
            throw new Error(`Template ${templateName} not found`);
        }

        return this.render(contentHtml, contentText, data);
    }

    private classifyError(error: any): { type: string; message: string; action: string } {
        const code = error.code || '';
        const command = error.command || '';

        if (code === 'ETIMEDOUT') {
            return {
                type: 'SMTP_TIMEOUT',
                message: 'Connection timed out. Network or Firewall issue.',
                action: 'Check firewall/infra outbound 465 or consider HTTP API'
            };
        }
        if (code === 'EAUTH' || command === 'AUTH') {
            return {
                type: 'SMTP_AUTH_FAILED',
                message: 'Invalid credentials or App Password revoked',
                action: 'Rotate App Password'
            };
        }
        if (code === 'EHOSTUNREACH' || code === 'ECONNREFUSED') {
            return {
                type: 'SMTP_UNREACHABLE',
                message: 'Host unreachable. DNS or Blocking issue.',
                action: 'Check DNS or Proxy settings'
            };
        }

        return {
            type: 'SMTP_UNKNOWN',
            message: error.message,
            action: 'Investigate logs'
        };
    }

    async sendVerificationEmail(email: string, token: string, expiryMinutes: number = 15) {
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://txproof.xyz'}/verify?token=${token}`;

        const { html, text } = this.renderFileTemplate('verification', {
            subject: 'Verify Your Email - TxProof Developers',
            verifyUrl: verificationUrl,
            expiryMinutes: expiryMinutes.toString()
        });

        await this.sendRaw(email, 'Verify Your Email - TxProof Developers', html, text);
    }

    async sendRaw(to: string, subject: string, html: string, text?: string) {
        const mailOptions: IEmailOptions = {
            from: `"TxProof Support" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html,
            text
        };

        try {
            logger.info('Starting email job', { to, subject });
            await this.provider.send(mailOptions);
            logger.info('Email sent successfully', { to, subject });
        } catch (error: any) {
            const classified = this.classifyError(error);

            logger.error('Failed to send email', {
                to,
                errorCategory: classified,
                rawError: error.message
            });

            // Re-throw with clean message for queue/circuit breaker
            throw new Error(`[${classified.type}] ${classified.message}`);
        }
    }

    /**
     * Injects tracking pixel and wraps links for analytics
     */
    public injectTracking(html: string, jobId: string): string {
        const appUrl = process.env.API_URL || 'https://backend.txproof.xyz'; // Or your API base
        const openPixel = `<img src="${appUrl}/api/v1/email/track/open/${jobId}" width="1" height="1" style="display:none;" />`;

        // 1. Append Open Pixel
        let newHtml = html;
        if (newHtml.includes('</body>')) {
            newHtml = newHtml.replace('</body>', `${openPixel}</body>`);
        } else {
            newHtml += openPixel;
        }

        // 2. Wrap Links (Simple Regex for href="http...")
        // Note: Using DOM parser is safer but regex is faster/easier for simple cases without JSDOM
        newHtml = newHtml.replace(/href="(http[^"]+)"/g, (match, url) => {
            // Skip already wrapped or internal tracking links if any (sanity check)
            if (url.includes('/email/track')) return match;

            const encodedUrl = encodeURIComponent(url);
            const trackingUrl = `${appUrl}/api/v1/email/track/click/${jobId}?url=${encodedUrl}`;
            return `href="${trackingUrl}"`;
        });

        return newHtml;
    }
}
