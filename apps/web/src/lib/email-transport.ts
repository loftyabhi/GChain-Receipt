import nodemailer from 'nodemailer';

interface SendEmailParams {
    to: string;
    replyTo: string;
    subject: string;
    text: string;
    html: string;
    displayFrom?: string;
}

// Singleton transporter pattern for Next.js (Lazy Initialized)
const getTransporter = () => {
    // Check inside function, not at top level
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        return null;
    }

    if (!global._nodemailerTransport) {
        global._nodemailerTransport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
            // Enterprise: Conservative timeouts to prevent hanging connections
            connectionTimeout: 10000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
        });
    }
    return global._nodemailerTransport;
};

// Global reference for development (type only)
declare global {
    var _nodemailerTransport: nodemailer.Transporter | undefined;
}

export async function sendEmail({ to, replyTo, subject, text, html, displayFrom }: SendEmailParams) {
    // Defensive check for credentials
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Mocking email - Missing credentials');
            console.log({ to, replyTo, subject, text });
            return { success: true, mocked: true };
        }
        throw new Error('Server configuration error: Missing email credentials');
    }

    const from = displayFrom
        ? `"${displayFrom}" <${process.env.GMAIL_USER}>`
        : process.env.GMAIL_USER;

    try {
        const transporter = getTransporter();
        if (!transporter) throw new Error('Transporter init failed');

        await transporter.sendMail({
            from,
            to,
            replyTo,
            subject,
            text,
            html,
        });
        return { success: true };
    } catch (error) {
        console.error('Nodemailer Error:', error);
        throw new Error('Failed to send email');
    }
}
