import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizeAuthEmail } from '@/lib/auth/normalize-email';
import { sendEmail, createEmailHTML } from '@/lib/email/nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeAuthEmail(String(body.email ?? '').trim());

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, password: { not: null } },
      select: { id: true, email: true, name: true },
    });

    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with that email, a reset link has been sent.',
      });
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
    await prisma.verificationToken.create({
      data: { identifier: user.email, token, expires },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        html: createEmailHTML(
          `Hello ${user.name ?? 'there'},\n\nUse this link to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`
        ),
      });
    } catch (mailErr) {
      console.error('[forgot-password] email failed:', mailErr);
    }

    return NextResponse.json({
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  } catch (error) {
    console.error('[api/auth/forgot-password]', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
