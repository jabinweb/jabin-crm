import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/encryption';
import { logError, logInfo } from '@/lib/logger';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

// Create reusable transporter with custom or default config
const createTransporter = (customConfig?: SmtpConfig) => {
  if (customConfig) {
    // Use per-user SMTP configuration
    return nodemailer.createTransport({
      host: customConfig.host,
      port: customConfig.port,
      secure: customConfig.secure, // true for 465, false for other ports
      auth: {
        user: customConfig.user,
        pass: customConfig.password,
      },
      // Explicitly require TLS when not using secure (enables STARTTLS for port 587)
      requireTLS: !customConfig.secure,
      tls: {
        // Do not fail on invalid certs (for development/self-signed)
        rejectUnauthorized: false,
      },
    });
  }
  
  // Fallback to default SMTP configuration from environment
  const isSecure = process.env.SMTP_SECURE === 'true';
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    requireTLS: !isSecure,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  smtpConfig?: SmtpConfig;
}

export async function sendEmail(options: SendEmailOptions) {
  const transporter = createTransporter(options.smtpConfig);

  const from = options.from || 
    (options.smtpConfig ? options.smtpConfig.user : (process.env.SMTP_FROM || process.env.SMTP_USER));

  const mailOptions = {
    from: from,
    to: options.to,
    subject: options.subject,
    text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    html: options.html,
    replyTo: options.replyTo || from,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logInfo('Email sent', { messageId: info.messageId });
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    logError(error, { context: 'Error sending email' });
    throw error;
  }
}

interface SendBulkEmailOptions {
  recipients: Array<{
    to: string;
    subject: string;
    html: string;
    leadId?: string;
  }>;
  from?: string;
  delay?: number; // Delay between emails in ms (to avoid rate limits)
}

export async function sendBulkEmails(options: SendBulkEmailOptions) {
  const results: Array<
    | { leadId?: string; email: string; success: true; messageId: string }
    | { leadId?: string; email: string; success: false; error: string }
  > = [];
  const delay = options.delay || 1000; // Default 1 second delay

  for (const recipient of options.recipients) {
    try {
      const result = await sendEmail({
        to: recipient.to,
        subject: recipient.subject,
        html: recipient.html,
        from: options.from,
      });

      results.push({
        leadId: recipient.leadId,
        email: recipient.to,
        success: true,
        messageId: result.messageId,
      });

      // Delay between emails to avoid rate limiting
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      results.push({
        leadId: recipient.leadId,
        email: recipient.to,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

// Test email configuration
export async function testEmailConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'Email configuration is valid' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// HTML email template
export function createEmailHTML(body: string, unsubscribeLink?: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-content {
      background: #ffffff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-content">
    ${body.replace(/\n/g, '<br>')}
  </div>
  ${unsubscribeLink ? `
  <div class="footer">
    <p>If you'd like to stop receiving emails from us, <a href="${unsubscribeLink}">click here to unsubscribe</a>.</p>
  </div>
  ` : ''}
</body>
</html>
  `.trim();
}

