import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { calendarService } from '@/lib/crm/calendar-service';
import { CalendarEventType, CalendarStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isMeetingsSchemaMissing } from '@/lib/meetings/service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const event = await calendarService.getEventById(
      params.id,
      session.user.id
    );

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Calendar event fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar event' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();
    const {
      title,
      description,
      location,
      eventType,
      startTime,
      endTime,
      allDay,
      attendees,
      meetingLink,
      reminderMinutes,
      status,
    } = body;

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (eventType) updateData.eventType = eventType as CalendarEventType;
    if (startTime) updateData.startTime = new Date(startTime);
    if (endTime) updateData.endTime = new Date(endTime);
    if (allDay !== undefined) updateData.allDay = allDay;
    if (attendees) updateData.attendees = attendees;
    if (meetingLink !== undefined) updateData.meetingLink = meetingLink;
    if (reminderMinutes !== undefined)
      updateData.reminderMinutes = reminderMinutes;
    if (status) updateData.status = status as CalendarStatus;

    const event = await calendarService.updateEvent(
      params.id,
      session.user.id,
      updateData
    );

    return NextResponse.json(event);
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    console.error('Calendar event update error:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    // Team meetings are cancelled (attendees are told), not silently deleted
    try {
      const meeting = await prisma.teamMeeting.findFirst({
        where: { eventId: params.id, event: { userId: session.user.id } },
        select: { id: true },
      });
      if (meeting) {
        return NextResponse.json(
          { error: 'This is a team meeting — cancel it instead so attendees are notified.', meetingId: meeting.id },
          { status: 409 }
        );
      }
    } catch (error) {
      if (!isMeetingsSchemaMissing(error)) throw error;
    }
    await calendarService.deleteEvent(params.id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    console.error('Calendar event deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar event' },
      { status: 500 }
    );
  }
}
