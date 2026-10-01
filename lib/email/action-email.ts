import { sendEmail } from './nodemailer';
import { getBrandConfig } from '@/lib/branding';

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Platform SMTP is optional in dev; callers skip quietly instead of throwing per email. */
export function isPlatformEmailConfigured() {
  return !!(process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim());
}

export type ActionEmailContent = {
  subject: string;
  /** Bold first line, e.g. "Priya mentioned you" */
  heading: string;
  /** One or two sentences of context */
  message: string;
  /** Optional plain-text quote (comment preview) */
  excerpt?: string | null;
  ctaLabel: string;
};

/**
 * Transactional email with a single call-to-action button
 * (task notifications, mentions, workspace invites).
 */
export async function sendActionEmail(params: {
  to: string;
  recipientName?: string | null;
  /** Shown next to the app name in the header, e.g. project or workspace name */
  contextLabel?: string | null;
  url: string;
  content: ActionEmailContent;
  /** Small print under the card: why the recipient got this email */
  footer: string;
}) {
  const brand = getBrandConfig();
  const { content } = params;
  const firstName = params.recipientName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="padding:0 4px 12px;font-size:13px;font-weight:600;color:${esc(brand.primaryColor)};">
        ${esc(brand.appName)}${params.contextLabel ? ` <span style="color:#a1a1aa;font-weight:400;">· ${esc(params.contextLabel)}</span>` : ''}
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;padding:28px;">
        <p style="margin:0 0 14px;font-size:14px;color:#52525b;">${esc(greeting)}</p>
        <p style="margin:0 0 6px;font-size:17px;font-weight:600;line-height:1.4;">${esc(content.heading)}</p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3f3f46;">${esc(content.message)}</p>
        ${
          content.excerpt
            ? `<div style="margin:0 0 22px;padding:10px 14px;border-left:3px solid #e4e4e7;font-size:14px;line-height:1.6;color:#52525b;">${esc(content.excerpt)}</div>`
            : ''
        }
        <a href="${esc(params.url)}" style="display:inline-block;background:${esc(brand.primaryColor)};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;">${esc(content.ctaLabel)}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 4px 0;font-size:12px;line-height:1.5;color:#a1a1aa;">
        ${esc(params.footer)}
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    greeting,
    '',
    content.heading,
    content.message,
    ...(content.excerpt ? ['', `"${content.excerpt}"`] : []),
    '',
    `${content.ctaLabel}: ${params.url}`,
    '',
    params.footer,
  ].join('\n');

  return sendEmail({
    to: params.to,
    subject: `[${brand.appName}] ${content.subject}`,
    html,
    text,
  });
}
