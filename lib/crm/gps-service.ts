import { prisma } from '@/lib/prisma';
import type { GpsSource } from '@prisma/client';

export interface CreateLocationInput {
  technicianId: string;
  ticketId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  source?: GpsSource;
  capturedAt?: Date;
}

export class GpsService {
  async logLocation(input: CreateLocationInput) {
    return prisma.technicianLocationLog.create({
      data: {
        technicianId: input.technicianId,
        ticketId: input.ticketId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        speed: input.speed,
        heading: input.heading,
        source: input.source || 'PWA',
        capturedAt: input.capturedAt || new Date(),
      },
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          select: { id: true, subject: true, status: true },
        },
      },
    });
  }

  async listLocations(filters?: {
    technicianId?: string;
    ticketId?: string;
    since?: Date;
  }) {
    const where: any = {};
    if (filters?.technicianId) where.technicianId = filters.technicianId;
    if (filters?.ticketId) where.ticketId = filters.ticketId;
    if (filters?.since) where.capturedAt = { gte: filters.since };

    return prisma.technicianLocationLog.findMany({
      where,
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          select: { id: true, subject: true, status: true },
        },
      },
      orderBy: { capturedAt: 'desc' },
    });
  }

  async getLiveSnapshot(hours = 8) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const logs = await prisma.technicianLocationLog.findMany({
      where: { capturedAt: { gte: since } },
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { capturedAt: 'desc' },
    });

    const latestByTechnician = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (!latestByTechnician.has(log.technicianId)) {
        latestByTechnician.set(log.technicianId, log);
      }
    }

    return Array.from(latestByTechnician.values());
  }
}

export const gpsService = new GpsService();
