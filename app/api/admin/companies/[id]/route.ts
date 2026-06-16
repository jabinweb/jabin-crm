import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, CompanyStatus } from '@prisma/client';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const { id } = await params;
    const companyId = id?.trim();

    if (!companyId) {
      return NextResponse.json({
        success: false,
        message: 'Invalid company ID'
      }, { status: 400 });
    }

    // Delete the company (this will cascade to related records)
    await prisma.company.delete({
      where: { id: companyId }
    });

    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('[API] Delete company error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete company'
    }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const { id } = await params;
    const companyId = id?.trim();
    const body = await req.json();

    if (!companyId) {
      return NextResponse.json({
        success: false,
        message: 'Invalid company ID'
      }, { status: 400 });
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: body.name,
        website: body.website,
        status: body.status as CompanyStatus,
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        userCompanies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCompany
    });
  } catch (error) {
    console.error('[API] Update company error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update company'
    }, { status: 500 });
  }
}