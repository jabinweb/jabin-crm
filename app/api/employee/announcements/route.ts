import { NextResponse } from "next/server"
import { auth } from '@/auth'

import { prisma } from "@/lib/prisma"

function companyIdFromSessionUser(user: unknown): string | undefined {
  const u = user as {
    employeeCompanyId?: string
    companyId?: string
    primaryCompanyId?: string
  } | null | undefined
  return u?.employeeCompanyId ?? u?.companyId ?? u?.primaryCompanyId
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromQuery = searchParams.get("companyId")?.trim()
    const companyId = fromQuery || companyIdFromSessionUser(session.user)

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required (query or session)" },
        { status: 400 }
      )
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        companyId,
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ],
      take: 10, // Limit to latest 10 announcements
    })

    return NextResponse.json(announcements)
  } catch (error) {
    console.error("Error fetching announcements:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String(session.user.role || "")
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = companyIdFromSessionUser(session.user)
    if (!companyId) {
      return NextResponse.json({ error: "No company context" }, { status: 400 })
    }

    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const content = typeof body.content === "string" ? body.content.trim() : ""
    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        priority: typeof body.priority === "number" ? body.priority : 0,
        companyId,
      },
    })

    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    console.error("Error creating announcement:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
