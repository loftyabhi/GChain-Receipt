'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { contactFormSchema, type ContactFormData } from '@/lib/validations/contact';
import { z } from 'zod';

export default function ContactForm() {
    const [formData, setFormData] = useState<ContactFormData>({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});

    const validateField = (name: keyof ContactFormData, value: string) => {
        try {
            contactFormSchema.shape[name].parse(value);
            setErrors((prev) => ({ ...prev, [name]: undefined }));
            return true;
        } catch (error) {
            if (error instanceof z.ZodError) {
                const issue = error.issues[0];
                setErrors((prev) => ({ ...prev, [name]: issue ? issue.message : 'Invalid input' }));
            }
            return false;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Real-time validation on change if error exists or for feedback
        if (errors[name as keyof ContactFormData]) {
            validateField(name as keyof ContactFormData, value);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        setIsSubmitting(true);

        const result = contactFormSchema.safeParse(formData);

        if (!result.success) {
            const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
            // Flatten errors for easier access
            const flattened = result.error.flatten();

            // Map field errors
            Object.keys(flattened.fieldErrors).forEach((key) => {
                const k = key as keyof ContactFormData;
                const messages = flattened.fieldErrors[k];
                if (messages && messages.length > 0) {
                    fieldErrors[k] = messages[0];
                }
            });

            setErrors(fieldErrors);
            setIsSubmitting(false);
            toast.error('Please fix the errors in the form.');
            return;
        }

        const toastId = toast.loading('Sending your message...');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.data),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to send message');
            }

            toast.success('Message sent successfully!', { id: toastId });
            setFormData({ name: '', email: '', subject: '', message: '' }); // Reset form
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong', { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white mb-6">Send us a message</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1">
                    <label htmlFor="name" className="text-sm font-medium text-gray-400">Name <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        onBlur={() => validateField('name', formData.name)}
                        className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.name ? 'border-red-500/50 focus:ring-red-500/20' : 'border-white/10 focus:ring-violet-500/20'} text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all`}
                        placeholder="Your full name"
                        disabled={isSubmitting}
                    />
                    {errors.name && <p className="text-sm text-red-400 mt-1">{errors.name}</p>}
                </div>

                <div className="space-y-1">
                    <label htmlFor="email" className="text-sm font-medium text-gray-400">Email <span className="text-red-500">*</span></label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={() => validateField('email', formData.email)}
                        className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.email ? 'border-red-500/50 focus:ring-red-500/20' : 'border-white/10 focus:ring-violet-500/20'} text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all`}
                        placeholder="you@example.com"
                        disabled={isSubmitting}
                    />
                    {errors.email && <p className="text-sm text-red-400 mt-1">{errors.email}</p>}
                </div>

                <div className="space-y-1">
                    <label htmlFor="subject" className="text-sm font-medium text-gray-400">Subject <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        onBlur={() => validateField('subject', formData.subject)}
                        className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.subject ? 'border-red-500/50 focus:ring-red-500/20' : 'border-white/10 focus:ring-violet-500/20'} text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all`}
                        placeholder="How can we help?"
                        disabled={isSubmitting}
                    />
                    {errors.subject && <p className="text-sm text-red-400 mt-1">{errors.subject}</p>}
                </div>

                <div className="space-y-1">
                    <label htmlFor="message" className="text-sm font-medium text-gray-400">Message <span className="text-red-500">*</span></label>
                    <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        onBlur={() => validateField('message', formData.message)}
                        rows={5}
                        className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.message ? 'border-red-500/50 focus:ring-red-500/20' : 'border-white/10 focus:ring-violet-500/20'} text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none`}
                        placeholder="Share your thoughts..."
                        disabled={isSubmitting}
                    />
                    {errors.message && <p className="text-sm text-red-400 mt-1">{errors.message}</p>}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
                </button>

                {/* Security: Honeypot field (hidden) */}
                <input
                    type="text"
                    name="_gotcha"
                    value={(formData as any)._gotcha || ''}
                    onChange={handleChange}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                />
            </form>
        </div>
    );
}
