import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { EmployeeStatus } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const emailNormalized = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
    if (!employee) {
      return NextResponse.json({ error: "Employee account not found" }, { status: 403 });
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      return NextResponse.json({
        error: `Employee account is not active (status: ${employee.status})`,
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: { id: user.id, email: user.email },
      employee: { id: employee.id, status: employee.status },
    });
  } catch (error) {
    console.error("Employee login error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    }, { status: 500 });
  }
}

