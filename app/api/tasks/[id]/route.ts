import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { CompanyTaskStatus } from '@prisma/client'
import "@/types/auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const id = (await params).id
    const task = await prisma.companyTask.findUnique({
      where: { id },
      include: {
        creator: true,
        assignee: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'desc' }
        },
        subTasks: {
          include: {
            assignee: true
          }
        },
        company: true
      }
    })

    if (!task) {
      return new Response(JSON.stringify({ error: 'CompanyTask not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(task), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch task',
      details: error instanceof Error ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const id = (await params).id
    const body = await request.json()

    // Handle status change timestamps
    const additionalData: any = {}
    if (body.status) {
      switch (body.status) {
        case CompanyTaskStatus.IN_PROGRESS:
          additionalData.startedAt = new Date()
          break
        case CompanyTaskStatus.COMPLETED:
          additionalData.completedAt = new Date()
          break
      }
    }

    const task = await prisma.companyTask.update({
      where: { id },
      data: {
        ...body,
        ...additionalData,
        updatedAt: new Date()
      },
      include: {
        creator: true,
        assignee: true,
        comments: {
          include: { author: true }
        },
        subTasks: true
      }
    })

    return new Response(JSON.stringify(task), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to update task',
      details: error instanceof Error ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const id = (await params).id

    // Delete task and cascade to comments and subtasks
    await prisma.companyTask.delete({
      where: { id },
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to delete task',
      details: error instanceof Error ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
