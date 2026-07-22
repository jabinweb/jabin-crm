import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_SETTINGS = {
  notifications: { email: true, push: false, inApp: true },
  theme: 'system',
  language: 'en',
}

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId: session.user.id,
          notifications: DEFAULT_SETTINGS.notifications,
          theme: DEFAULT_SETTINGS.theme,
          language: DEFAULT_SETTINGS.language,
        },
      })
    }

    return NextResponse.json({
      id: settings.id,
      userId: settings.userId,
      notifications: settings.notifications,
      theme: settings.theme,
      language: settings.language,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    })
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data: {
      notifications?: object
      theme?: string
      language?: string
    } = {}

    if (body.notifications && typeof body.notifications === 'object') {
      data.notifications = body.notifications
    }
    if (typeof body.theme === 'string') data.theme = body.theme
    if (typeof body.language === 'string') data.language = body.language

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        notifications: (data.notifications as object) || DEFAULT_SETTINGS.notifications,
        theme: data.theme || DEFAULT_SETTINGS.theme,
        language: data.language || DEFAULT_SETTINGS.language,
      },
      update: data,
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
