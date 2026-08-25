import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { normalizeAuthEmail } from '@/lib/auth/normalize-email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeAuthEmail(String(body.email ?? '').trim());
    const token = String(body.token ?? '').trim();
    const password = String(body.password ?? '');

    if (!email || !token || !password) {
      return NextResponse.json({ error: 'Email, token, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const record = await prisma.verificationToken.findFirst({
      where: { identifier: email, token },
    });

    if (!record || record.expires < new Date()) {
      return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/auth/reset-password]', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
