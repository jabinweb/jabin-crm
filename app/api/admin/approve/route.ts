import { NextRequest, NextResponse } from "next/server";
import { auth } from '@/auth'
import { prisma } from "@/lib/prisma";
import { CompanyStatus, UserStatus, EmployeeStatus, Prisma, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/** Interactive `$transaction` callback param is not inferred on the Accelerate-extended client. */
type ApproveTransactionClient = Pick<PrismaClient, "company" | "user" | "employee">;

type PendingCompanyRow = Prisma.CompanyGetPayload<{
  select: {
    id: true;
    name: true;
    website: true;
    status: true;
    createdAt: true;
    adminId: true;
    admin: { select: { name: true; email: true } };
  };
}>;

type PendingUserRow = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    userStatus: true;
    createdAt: true;
    primaryCompany: { select: { name: true; website: true } };
  };
}>;

type UpdatedPendingCompanyRow = Prisma.CompanyGetPayload<{
  select: {
    id: true;
    name: true;
    website: true;
    status: true;
    createdAt: true;
    admin: { select: { name: true; email: true } };
  };
}>;

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || (session.user as any).role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Updated queries to match schema relationships
    const [pendingCompaniesRaw, pendingUsersRaw] = await Promise.all([
      prisma.company.findMany({
        where: { status: CompanyStatus.PENDING },
        select: {
          id: true,
          name: true,
          website: true,
          status: true,
          createdAt: true,
          adminId: true,
          admin: {
            select: {
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: {
          AND: [
            { userStatus: UserStatus.PENDING },
            { role: UserRole.ADMIN }
          ]
        },
        select: {
          id: true,
          name: true,
          email: true,
          userStatus: true,
          createdAt: true,
          primaryCompany: {
            select: {
              name: true,
              website: true,
            }
          }
        },
        orderBy: { createdAt: "desc" },
      })
    ]);

    const pendingCompanies = pendingCompaniesRaw as PendingCompanyRow[];
    const pendingUsers = pendingUsersRaw as PendingUserRow[];

    // Transform the data to match the expected format
    const formattedCompanies = pendingCompanies.map((company) => ({
      id: company.id,
      name: company.name,
      website: company.website,
      status: company.status,
      createdAt: company.createdAt,
      admin: company.admin,
    }));

    const formattedUsers = pendingUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.userStatus,
      createdAt: user.createdAt,
      primaryCompany: user.primaryCompany
    }));

    return NextResponse.json({
      success: true,
      data: {
        companies: formattedCompanies,
        users: formattedUsers
      }
    });

  } catch (error) {
    console.error("Error fetching pending items:", error instanceof Error ? error.message : "Unknown error");
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch pending items" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || (session.user as any).role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, action, type } = body;

    if (!id || !action || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? UserStatus.ACTIVE : UserStatus.REJECTED;
    const companyStatus = action === 'approve' ? CompanyStatus.APPROVED : CompanyStatus.REJECTED;

    try {
      await prisma.$transaction(async (tx: ApproveTransactionClient) => {
        if (type === 'company') {
          console.log('Updating company:', id, 'to status:', companyStatus); // Debug log

          // Update company status with correct relation names
          const company = await tx.company.update({
            where: { id: String(id) },
            data: { status: companyStatus },
            include: {
              employees: true,
              admin: true,
              userCompanies: {
                include: {
                  user: true,
                },
              },
            },
          });

          console.log('Company updated:', company); // Debug log

          if (action === 'approve') {
            // Update admin user if exists
            if (company.admin?.userId) {
              await tx.user.update({
                where: { id: company.admin.userId },
                data: { userStatus: UserStatus.ACTIVE }
              });
            }

            // Update all company users
            if (company.userCompanies.length > 0) {
              await tx.user.updateMany({
                where: {
                  id: {
                    in: company.userCompanies.map(uc => uc.userId)
                  }
                },
                data: { userStatus: UserStatus.ACTIVE }
              });
            }

            // Update all employees
            if (company.employees.length > 0) {
              await tx.employee.updateMany({
                where: { companyId: company.id },
                data: { 
                  status: EmployeeStatus.ACTIVE,
                  isApproved: true 
                }
              });
            }
          }
        }

        if (type === 'user') {
          // Update user and related records with correct relation names
          const user = await tx.user.update({
            where: { id: String(id) },
            data: { userStatus: newStatus },
            include: {
              employeeProfile: true,
              primaryCompany: true
            }
          });

          if (action === 'approve' && user.employeeProfile) {
            // Update employee status using correct relation
            await tx.employee.update({
              where: { id: user.employeeProfile.id },
              data: { 
                status: EmployeeStatus.ACTIVE,
                isApproved: true 
              }
            });

            // If user is admin, update company status
            if (user.role === UserRole.ADMIN && user.primaryCompany) {
              await tx.company.update({
                where: { id: user.primaryCompany.id },
                data: { status: CompanyStatus.APPROVED }
              });
            }
          }
        }
      });

      // Fetch updated data with correct relation names
      const [updatedCompaniesRaw, updatedUsersRaw] = await Promise.all([
        prisma.company.findMany({
          where: { status: CompanyStatus.PENDING },
          select: {
            id: true,
            name: true,
            website: true,
            status: true,
            createdAt: true,
            admin: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.findMany({
          where: {
            AND: [
              { userStatus: UserStatus.PENDING },
              { role: UserRole.ADMIN }
            ]
          },
          select: {
            id: true,
            name: true,
            email: true,
            userStatus: true,
            createdAt: true,
            primaryCompany: {
              select: {
                name: true,
                website: true,
              }
            }
          },
          orderBy: { createdAt: "desc" },
        })
      ]);

      const updatedCompanies = updatedCompaniesRaw as UpdatedPendingCompanyRow[];
      const updatedUsers = updatedUsersRaw as PendingUserRow[];

      // Transform data for response
      const formattedUsers = updatedUsers.map((user) => ({
        ...user,
        status: user.userStatus,
        primaryCompany: user.primaryCompany
      }));

      return NextResponse.json({
        success: true,
        message: `Successfully ${action}d the ${type}`,
        data: {
          companies: updatedCompanies,
          users: formattedUsers
        }
      });

    } catch (txError) {
      if (txError instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json(
          { success: false, error: "Database operation failed" },
          { status: 400 }
        );
      }
      throw txError;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing approval:", errorMessage);

    return NextResponse.json(
      { success: false, error: "Failed to process approval" },
      { status: 500 }
    );
  }
}

