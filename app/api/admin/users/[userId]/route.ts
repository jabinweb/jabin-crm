import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    const sessionRole = (session?.user as any)?.role;
    const isSuperAdmin = sessionRole === "SUPER_ADMIN" || sessionRole === "admin";

    if (!session?.user || !isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscription: {
          include: {
            plan: true,
          },
        },
        usage: true,
        _count: {
          select: {
            leads: true,
            emailCampaigns: true,
            emailLogs: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    const sessionRole = (session?.user as any)?.role;
    const isSuperAdmin = sessionRole === "SUPER_ADMIN" || sessionRole === "admin";

    if (!session?.user || !isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { role: nextRole, name, email } = body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nextRole && { role: nextRole }),
        ...(name && { name }),
        ...(email && { email }),
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    const sessionRole = (session?.user as any)?.role;
    const isSuperAdmin = sessionRole === "SUPER_ADMIN" || sessionRole === "admin";

    if (!session?.user || !isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
