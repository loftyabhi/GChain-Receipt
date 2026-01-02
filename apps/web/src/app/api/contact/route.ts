import { NextResponse } from 'next/server';
import { contactFormSchema } from '@/lib/validations/contact';
import { sendEmail } from '@/lib/email-transport';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

// MANDATORY: Force Node.js runtime for Nodemailer support (Edge check)
export const runtime = 'nodejs';

// Rate limiter: 5 requests per hour per IP
const limiter = rateLimit({
    interval: 60 * 60 * 1000,
    uniqueTokenPerInterval: 500,
});

export async function POST(req: Request) {
    try {
        // 1. IP-based Rate Limiting
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for') || 'unknown';

        try {
            await limiter.check(5, ip);
        } catch {
            return NextResponse.json(
                { message: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        // 2. Input Validation (Zod)
        const body = await req.json();
        const result = contactFormSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { message: 'Invalid input', errors: result.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { name, email, subject, message, _gotcha } = result.data;

        // Security: Honeypot Check
        // If _gotcha is filled, it's a bot. Fail silently or with generic success to fool them.
        if (_gotcha) {
            console.warn(`Honeypot triggered by IP: ${ip}`);
            return NextResponse.json(
                { message: 'Message sent successfully' }, // Lie to the bot
                { status: 200 }
            );
        }

        // Privacy: Data is processed in-memory for email delivery only and not persisted to any database.

        // 3. HTML Sanitization (Simple escaping for email body)
        const safeMessage = message.replace(/[&<>"']/g, (char) => {
            const chars: Record<string, string> = {
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            };
            return chars[char] || char;
        });

        const safeSubject = subject.replace(/[&<>"']/g, ''); // Strip chars for subject

        // 4. Send Email
        await sendEmail({
            to: 'sarkaritoolmail@gmail.com',
            replyTo: email,
            subject: `Contact Form: ${safeSubject}`,
            text: `
Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
        `,
            html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4f46e5;">New Contact Message</h2>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Subject:</strong> ${safeSubject}</p>
                </div>
                <div style="border-left: 4px solid #4f46e5; padding-left: 15px;">
                    <p style="white-space: pre-wrap;">${safeMessage}</p>
                </div>
                <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #666;">
                    Sent securely via Chain Receipt Contact Form.<br>
                    Click "Reply" to respond directly to the user.
                </p>
            </div>
        `,
            displayFrom: "Chain Receipt Contact"
        });

        return NextResponse.json(
            { message: 'Message sent successfully' },
            { status: 200 }
        );

    } catch (error: any) {
        console.error('Contact API Error:', error);

        // Defensive: Don't leak actual error details to client unless dev
        const errorMessage = process.env.NODE_ENV === 'development'
            ? error.message
            : 'Failed to send message. Please try again.';

        return NextResponse.json(
            { message: errorMessage },
            { status: 500 }
        );
    }
}
