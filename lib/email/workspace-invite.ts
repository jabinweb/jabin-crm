import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrl } from '@/lib/app-url';
import { logError } from '@/lib/logger';
import { isPlatformEmailConfigured, sendActionEmail } from './action-email';

const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Email a teammate their way into a workspace.
 * New accounts get a set-password link (same token flow as password reset, valid 7 days);
 * existing accounts just get a sign-in link. Returns whether an email actually went out.
 */
export async function sendWorkspaceInviteEmail(params: {
  email: string;
  name?: string | null;
  companyName: string;
  inviterName: string;
  role: string;
  /** False when the account already existed and was only added to the workspace */
  isNewAccount: boolean;
}): Promise<boolean> {
  if (!isPlatformEmailConfigured()) return false;

  try {
    const baseUrl = getAppBaseUrl().replace(/\/$/, '');
    let url = `${baseUrl}/auth/signin`;

    if (params.isNewAccount) {
      const token = randomBytes(32).toString('hex');
      await prisma.verificationToken.deleteMany({ where: { identifier: params.email } });
      await prisma.verificationToken.create({
        data: {
          identifier: params.email,
          token,
          expires: new Date(Date.now() + INVITE_LINK_TTL_MS),
        },
      });
      url = `${baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(params.email)}`;
    }

    const roleLabel = params.role.replace(/_/g, ' ').toLowerCase();
    await sendActionEmail({
      to: params.email,
      recipientName: params.name,
      contextLabel: params.companyName,
      url,
      content: params.isNewAccount
        ? {
            subject: `${params.inviterName} invited you to ${params.companyName}`,
            heading: `You have been invited to ${params.companyName}`,
            message: `${params.inviterName} added you as ${roleLabel}. Set your password to finish creating your account — the link is valid for 7 days. Your sign-in email is ${params.email}.`,
            ctaLabel: 'Set password and join',
          }
        : {
            subject: `You were added to ${params.companyName}`,
            heading: `You now have access to ${params.companyName}`,
            message: `${params.inviterName} added you to this workspace. Sign in with your existing account (${params.email}).`,
            ctaLabel: 'Sign in',
          },
      footer: `You are receiving this because ${params.inviterName} invited you to the ${params.companyName} workspace.`,
    });
    return true;
  } catch (error) {
    logError(error, { context: 'workspace invite email failed' });
    return false;
  }
}
