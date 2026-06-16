import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.user.customerId },
      select: {
        id: true,
        companyId: true,
        organizationName: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: customer.contactPerson,
      email: customer.email ?? session.user.email,
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      organizationName: customer.organizationName,
      companyId: customer.companyId,
    });
  } catch (error) {
    console.error('[api/portal/profile GET]', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const customerId = session.user.customerId;

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        contactPerson: body.name ?? undefined,
        organizationName: body.organizationName ?? undefined,
        phone: body.phone ?? undefined,
        address: body.address ?? undefined,
      },
    });

    if (body.name && session.user.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name: body.name },
      }).catch(() => null);
    }

    return NextResponse.json({
      name: customer.contactPerson,
      email: customer.email ?? session.user.email,
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      organizationName: customer.organizationName,
    });
  } catch (error) {
    console.error('[api/portal/profile PATCH]', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
