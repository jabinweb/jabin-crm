import { NextRequest } from "next/server"
import { auth } from '@/auth'
import { prisma } from "@/lib/prisma"
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from "@/lib/auth/company-membership"
import "@/types/auth"

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

    const clients = await prisma.client.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    })

    return new Response(JSON.stringify(clients), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    console.error("Error fetching clients:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to fetch clients",
        details: error instanceof Error ? error.message : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
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
    const { companyId: _strip, ...rest } = body as Record<string, unknown>

    const newClient = await prisma.client.create({
      data: {
        ...rest,
        companyId,
      } as any,
    })

    return new Response(JSON.stringify(newClient), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    console.error("Error creating client:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to create client",
        details: error instanceof Error ? error.message : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
