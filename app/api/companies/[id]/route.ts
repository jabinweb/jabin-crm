import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveCompanyContextFromRequest, TenantError } from "@/lib/auth/company-membership"

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
    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const companyId = (await params).id?.trim()
    if (!companyId) {
      return new Response(JSON.stringify({ error: "Invalid company ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const role = (session.user as any)?.role as string | undefined
    if (role !== "SUPER_ADMIN") {
      const ctx = await resolveCompanyContextFromRequest(session, request)
      if (ctx.companyId !== companyId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        website: true,
        logo: true,
        status: true,
        createdAt: true,
      },
    })

    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify(company), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    return new Response(JSON.stringify({ error: "Failed to fetch company" }), {
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
    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const companyId = (await params).id?.trim()
    if (!companyId) {
      return new Response(JSON.stringify({ error: "Invalid company ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const role = (session.user as any)?.role as string | undefined
    if (role !== "SUPER_ADMIN") {
      const ctx = await resolveCompanyContextFromRequest(session, request)
      if (ctx.companyId !== companyId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    const data = await request.json()

    const company = await prisma.company.update({
      where: {
        id: companyId,
      },
      data: {
        name: data.name,
        website: data.website,
        logo: data.logo,
        status: data.status,
      },
    })

    return new Response(JSON.stringify(company), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    return new Response(JSON.stringify({ error: "Failed to update company" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
