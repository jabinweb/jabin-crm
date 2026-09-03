import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logError } from '@/lib/logger';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from?: string;
}

/**
 * Get SMTP configuration for a user
 * Returns user's custom SMTP if configured, otherwise returns default from env
 */
export async function getUserSmtpConfig(userId: string): Promise<SmtpConfig | null> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFrom: true,
        companyEmail: true,
        useAdminEmail: true,
      },
    });

    if (!profile) {
      return null;
    }

    // Check if user has custom SMTP configured
    if (profile.smtpHost && profile.smtpUser && profile.smtpPassword) {
      const decryptedPassword = decrypt(profile.smtpPassword);
      
      return {
        host: profile.smtpHost,
        port: profile.smtpPort || 587,
        secure: profile.smtpSecure || false,
        user: profile.smtpUser,
        password: decryptedPassword,
        from: profile.smtpFrom || profile.companyEmail || profile.smtpUser,
      };
    }

    return null;
  } catch (error) {
    logError(error, { context: 'Error getting user SMTP config' });
    return null;
  }
}

/**
 * Check if user has SMTP configured
 */
export async function hasUserSmtpConfig(userId: string): Promise<boolean> {
  const config = await getUserSmtpConfig(userId);
  return config !== null;
}

/**
 * Get the "from" email address for a user
 * Returns custom email if configured, otherwise admin email
 */
export async function getUserFromEmail(userId: string): Promise<string> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        smtpFrom: true,
        companyEmail: true,
        smtpUser: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!profile) {
      return process.env.SMTP_FROM || process.env.SMTP_USER || '';
    }

    // Priority: smtpFrom > companyEmail > smtpUser > admin email
    return (
      profile.smtpFrom ||
      profile.companyEmail ||
      profile.smtpUser ||
      profile.user.email ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      ''
    );
  } catch (error) {
    logError(error, { context: 'Error getting user from email' });
    return process.env.SMTP_FROM || process.env.SMTP_USER || '';
  }
}
