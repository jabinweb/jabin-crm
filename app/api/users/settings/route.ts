import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userEmail = searchParams.get('userId')

  if (!userEmail) {
    return new Response(JSON.stringify({ error: "Invalid user email" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        primaryCompany: true,
        company: true,
        userCompanies: {
          include: {
            company: true,
          },
        },
      },
    })

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      name: user.name,
      email: user.email,
      role: user.role,
      primaryCompany: user.primaryCompany,
      currentCompany: user.company,
      companies: user.userCompanies.map((uc) => uc.company),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("Error fetching user settings:", error)
    return new Response(JSON.stringify({ 
      error: "Failed to fetch user settings",
      details: error instanceof Error ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

