import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from "@/lib/auth/company-membership"

function tenantJsonResponse(err: TenantError) {
  return new Response(JSON.stringify({ error: err.message }), {
    status: err.status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await auth()
    const { companyId } = await resolveCompanyContextFromRequest(session, request)

    const projects = await prisma.project.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
    })

    return new Response(JSON.stringify(projects), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    console.error("[API] Projects list error:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch projects" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role as string | undefined
    if (!role || !["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const description =
      typeof body.description === "string" ? body.description : ""
    const status = typeof body.status === "string" ? body.status : "ACTIVE"
    const start = body.startDate ? new Date(body.startDate) : new Date()
    const end = body.endDate ? new Date(body.endDate) : new Date()
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid dates" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        status,
        startDate: start,
        endDate: end,
        companyId,
      },
    })

    return new Response(JSON.stringify(project), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    console.error("[API] Project create error:", error)
    return new Response(JSON.stringify({ error: "Failed to create project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
