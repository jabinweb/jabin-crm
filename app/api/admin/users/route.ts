import { NextRequest, NextResponse } from "next/server";
import { auth } from '@/auth'
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus, Prisma } from "@prisma/client";

type AdminUserListRow = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    role: true;
    userStatus: true;
    createdAt: true;
    primaryCompany: {
      select: { id: true; name: true; status: true };
    };
    userCompanies: {
      select: {
        company: { select: { id: true; name: true; status: true } };
      };
    };
  };
}>;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const users = (await prisma.user.findMany({
      where: {
        role: { not: UserRole.SUPER_ADMIN }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userStatus: true,
        createdAt: true,
        primaryCompany: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        userCompanies: {
          select: {
            company: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })) as AdminUserListRow[];

    // Transform the data to match expected format
    const transformedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.userStatus,
      createdAt: user.createdAt,
      primaryCompany: user.primaryCompany,
      companies: user.userCompanies.map(
        (uc: AdminUserListRow["userCompanies"][number]) => uc.company
      ),
    }));

    return NextResponse.json({
      success: true,
      data: transformedUsers
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error('Error fetching users:', errorMessage);
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || status === undefined || status === null || status === "") {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const userStatus = status as UserStatus;
    if (!Object.values(UserStatus).includes(userStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid user status" },
        { status: 400 }
      );
    }

    const updatedUser = (await prisma.user.update({
      where: { id: String(id) },
      data: { userStatus },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userStatus: true,
        createdAt: true,
        primaryCompany: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        userCompanies: {
          select: {
            company: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    })) as AdminUserListRow;

    return NextResponse.json({
      success: true,
      data: {
        ...updatedUser,
        status: updatedUser.userStatus,
        primaryCompany: updatedUser.primaryCompany,
        companies: updatedUser.userCompanies.map((uc) => uc.company),
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error('Error updating user:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update user",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

