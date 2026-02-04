
-- Migration: Insert Verification Template
-- Description: Adds the standard verification email template to the database for use by EmailQueueService.

INSERT INTO email_templates (name, subject, html_content, category, is_active)
VALUES (
    'admin-verification', 
    'Verify Your Email - TxProof Developers',
    '<h1 style="margin: 0; margin-bottom: 24px; font-size: 28px; font-weight: 700; color: #ffffff;">Verify your email to activate your TxProof account</h1><p style="margin: 0; margin-bottom: 32px; font-size: 16px; line-height: 1.6; color: #bbbbbb;">Hi there,<br><br>You''re one step away from using TxProof to generate verifiable blockchain receipts and production-ready transaction proofs.<br><br>Confirm your email address to activate your developer account and start issuing cryptographically secure receipts.</p><div align="center" style="margin-bottom: 32px;"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{verifyUrl}}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="24%" stroke="f" fillcolor="#7c3aed"><w:anchorlock/><center><![endif]--><a href="{{verifyUrl}}" class="hover-bg-violet-500" style="background-color: #7c3aed; border-radius: 12px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 700; line-height: 52px; text-align: center; text-decoration: none; width: 240px; -webkit-text-size-adjust: none;">Activate My Account</a><!--[if mso]></center></v:roundrect><![endif]--></div><p style="margin: 0; margin-bottom: 32px; font-size: 14px; line-height: 1.6; color: #666666; text-align: center;">For security, this link expires in <strong>{{expiryMinutes}} minutes</strong>.</p><div style="background-color: #1a1a1a; border-radius: 12px; padding: 16px; margin-bottom: 0;"><p style="margin: 0; font-size: 12px; color: #888888; word-break: break-all;"><strong>If the button doesn’t work, copy and open this link in your browser:</strong><br><br><a href="{{verifyUrl}}" style="color: #7c3aed; text-decoration: none;">{{verifyUrl}}</a></p></div>',
    'transactional',
    true
)
ON CONFLICT (name) DO UPDATE SET 
    html_content = EXCLUDED.html_content,
    subject = EXCLUDED.subject;
