import nodemailer from 'nodemailer';

interface SendEmailParams {
    to: string;
    replyTo: string;
    subject: string;
    text: string;
    html: string;
    displayFrom?: string;
}

// Singleton transporter pattern for Next.js to avoid multiple connections in dev
const getTransporter = () => {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        throw new Error('Missing GMAIL_USER or GMAIL_PASS environment variables');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
        // Enterprise: Conservative timeouts to prevent hanging connections
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,    // 5 seconds
        socketTimeout: 10000,     // 10 seconds
    });
};

// Global reference for development
declare global {
    var _nodemailerTransport: nodemailer.Transporter | undefined;
}

const transporter = global._nodemailerTransport || getTransporter();

if (process.env.NODE_ENV === 'development') {
    global._nodemailerTransport = transporter;
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
