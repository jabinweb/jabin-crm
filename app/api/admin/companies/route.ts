import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, CompanyStatus, Prisma } from '@prisma/client';
import { buildInitialCompanySettings } from '@/lib/workspace-config';
import { completedOnboardingState } from '@/lib/onboarding/company-onboarding';

type CompanyListRow = Prisma.CompanyGetPayload<{
  include: {
    userCompanies: {
      include: {
        user: { select: { id: true; name: true; email: true; role: true } };
      };
    };
    employees: {
      select: { id: true; name: true; email: true; status: true };
    };
    _count: {
      select: { employees: true; userCompanies: true };
    };
  };
}>;

function slugFromName(name: string): string {
  const base = String(name || 'company')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'company';
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any; // Cast to bypass type issues
    
    console.log('[API] Session check:', {
      hasSession: !!session,
      hasUser: !!user,
      userRole: user?.role,
      expectedRole: UserRole.SUPER_ADMIN
    });
    
    // Check if user is super admin
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized - Super Admin access required' 
      }, { status: 401 });
    }

    const companies = (await prisma.company.findMany({
      include: {
        userCompanies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        employees: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        _count: {
          select: {
            employees: true,
            userCompanies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })) as CompanyListRow[];

    // Format the response to match the expected interface
    const formattedCompanies = companies.map((company) => ({
      id: company.id,
      name: company.name,
      website: company.website,
      status: company.status,
      createdAt: company.createdAt.toISOString(),
      admin: (() => {
        const adminUc = company.userCompanies.find(
          (uc: CompanyListRow["userCompanies"][number]) =>
            uc.user.role === UserRole.ADMIN
        );
        return adminUc?.user
          ? { name: adminUc.user.name, email: adminUc.user.email }
          : undefined;
      })(),
      employees: company.employees,
    }));

    return NextResponse.json({
      success: true,
      data: formattedCompanies
    });
  } catch (error) {
    console.error('[API] Get companies error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch companies'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any; // Cast to bypass type issues
    
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await req.json();
    const { name, website, status } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Company name is required' },
        { status: 400 }
      );
    }

    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? body.slug.trim().toLowerCase()
        : `${slugFromName(name)}-${randomUUID().slice(0, 8)}`;

    const settings = {
      ...buildInitialCompanySettings('general'),
      onboarding: completedOnboardingState(),
    };

    const company = await prisma.company.create({
      data: {
        name,
        website,
        status: (status as CompanyStatus) ?? CompanyStatus.PENDING,
        slug,
        settings,
      },
    });

    return NextResponse.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('[API] Create company error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create company'
    }, { status: 500 });
  }
}

