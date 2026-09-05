import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, CompanyStatus, Prisma } from '@prisma/client';
import {
  CompanyNotFoundError,
  deleteCompanyCascade,
} from '@/lib/admin/delete-company';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const companyId = id?.trim();

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid company ID',
        },
        { status: 400 }
      );
    }

    const result = await deleteCompanyCascade(companyId);

    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully',
      data: result,
    });
  } catch (error) {
    console.error('[API] Delete company error:', error);

    if (error instanceof CompanyNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Company not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          {
            success: false,
            message: 'Company not found',
            code: 'NOT_FOUND',
          },
          { status: 404 }
        );
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          {
            success: false,
            message:
              'Cannot delete company: related records still reference it. Check foreign-key constraints and try again.',
            code: 'FK_CONSTRAINT',
            details: error.meta,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          message: 'Database error while deleting company',
          code: error.code,
        },
        { status: 500 }
      );
    }

    const message =
      error instanceof Error ? error.message : 'Failed to delete company';

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const companyId = id?.trim();
    const body = await req.json();

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid company ID',
        },
        { status: 400 }
      );
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
      data: updatedCompany,
    });
  } catch (error) {
    console.error('[API] Update company error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update company',
      },
      { status: 500 }
    );
  }
}
