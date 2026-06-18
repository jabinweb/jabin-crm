import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { normalizeAuthEmail } from '@/lib/auth/normalize-email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const { id: customerId } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: {
        id: true,
        email: true,
        contactPerson: true,
        organizationName: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeAuthEmail(
      String(body.email ?? customer.email ?? '').trim()
    );

    if (!email) {
      return NextResponse.json(
        { error: 'Customer must have an email address to invite' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, customerId: true, role: true },
    });

    if (existingUser) {
      if (existingUser.customerId === customerId) {
        return NextResponse.json({
          message: 'Portal user already exists',
          userId: existingUser.id,
          alreadyInvited: true,
        });
      }
      return NextResponse.json(
        { error: 'Email already registered to another account' },
        { status: 409 }
      );
    }

    const tempPassword = randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: customer.contactPerson || customer.organizationName,
        role: 'CUSTOMER',
        customerId: customer.id,
        password: hashedPassword,
        userStatus: 'ACTIVE',
        companyId,
        primaryCompanyId: companyId,
      },
      select: { id: true, email: true, name: true },
    });

    if (!customer.email) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { email },
      });
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    return NextResponse.json({
      message: 'Portal invite created',
      user,
      signInUrl: `${baseUrl}/auth/signin`,
      temporaryPassword: tempPassword,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/customers/invite]', error);
    return NextResponse.json({ error: 'Failed to invite customer' }, { status: 500 });
  }
}
