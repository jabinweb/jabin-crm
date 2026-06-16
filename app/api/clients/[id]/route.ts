import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user?.role || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const id = (await params).id
    const body = await request.json()
    const { companyId: _bodyCompanyId, ...updates } = body as Record<string, unknown>

    const updatedClient = await prisma.client.update({
      where: { id, companyId },
      data: {
        ...updates,
        companyId,
      } as any,
    })

    return new Response(JSON.stringify(updatedClient), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    console.error("Client update error:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to update client",
        details: error instanceof Error ? error.message : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user?.role || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const id = (await params).id
    await prisma.client.delete({
      where: { id, companyId },
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof TenantError) return tenantJsonResponse(error)
    console.error("Client deletion error:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to delete client",
        details: error instanceof Error ? error.message : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
