import { sendEmail, createEmailHTML } from './nodemailer';

export async function sendPortalInviteEmail(params: {
  to: string;
  customerName: string;
  organizationName: string;
  companyName: string;
  signInUrl: string;
  temporaryPassword: string;
}) {
  const { to, customerName, organizationName, companyName, signInUrl, temporaryPassword } = params;

  const body = `
Hello ${customerName},

You've been invited to the ${companyName} customer portal for ${organizationName}.

Sign in here: ${signInUrl}

Your temporary password: ${temporaryPassword}

Please sign in and change your password after your first visit.

If you did not expect this invitation, you can ignore this email.

Best regards,
${companyName} Support
  `.trim();

  return sendEmail({
    to,
    subject: `You're invited to ${companyName}'s customer portal`,
    html: createEmailHTML(body),
  });
}
