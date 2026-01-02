import { z } from 'zod';

export const contactFormSchema = z.object({
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters')
        .trim(),
    email: z
        .string()
        .email('Please enter a valid email address')
        .max(100, 'Email must be less than 100 characters')
        .trim()
        .toLowerCase(),
    subject: z
        .string()
        .min(5, 'Subject must be at least 5 characters')
        .max(100, 'Subject must be less than 100 characters')
        .trim(),
    message: z
        .string()
        .min(10, 'Message must be at least 10 characters')
        .max(1000, 'Message must be less than 1000 characters')
        .trim(),
    // Security: Honeypot field (should be empty)
    _gotcha: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
