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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth()
    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const id = (await params).id

    const project = await prisma.project.findFirst({
      where: { id, companyId },
    })

    if (!project) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify(project), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    return new Response(JSON.stringify({ error: "Failed to fetch project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
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
    const id = (await params).id
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (typeof body.name === "string") data.name = body.name.trim()
    if (typeof body.description === "string") data.description = body.description
    if (typeof body.status === "string") data.status = body.status
    if (body.startDate) {
      const d = new Date(body.startDate)
      if (!Number.isNaN(d.getTime())) data.startDate = d
    }
    if (body.endDate) {
      const d = new Date(body.endDate)
      if (!Number.isNaN(d.getTime())) data.endDate = d
    }

    const existing = await prisma.project.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    const project = await prisma.project.update({
      where: { id },
      data: data as any,
    })

    return new Response(JSON.stringify(project), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    return new Response(JSON.stringify({ error: "Failed to update project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
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
    const id = (await params).id
    const deleted = await prisma.project.deleteMany({
      where: { id, companyId },
    })
    if (deleted.count === 0) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    return new Response(JSON.stringify({ error: "Failed to delete project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
