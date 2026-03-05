import { prisma } from '@/lib/prisma';
import { NotificationType } from '@prisma/client';

interface CreateNotificationParams {
    type: NotificationType;
    title: string;
    body: string;
    /** Target one or both of userId / customerId */
    userId?: string;
    customerId?: string;
    metadata?: Record<string, any>;
}

export class NotificationService {
    async create(params: CreateNotificationParams) {
        return prisma.notification.create({
            data: {
                type: params.type,
                title: params.title,
                body: params.body,
                userId: params.userId ?? null,
                customerId: params.customerId ?? null,
                metadata: params.metadata ?? {},
            },
        });
    }

    async getForUser(userId: string, limit = 20) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { customerId: true } });

        return prisma.notification.findMany({
            where: {
                OR: [
                    { userId },
                    ...(user?.customerId ? [{ customerId: user.customerId }] : []),
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async markRead(id: string) {
        return prisma.notification.update({ where: { id }, data: { read: true } });
    }

    async markAllRead(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { customerId: true } });
        return prisma.notification.updateMany({
            where: {
                OR: [
                    { userId },
                    ...(user?.customerId ? [{ customerId: user.customerId }] : []),
                ],
                read: false,
            },
            data: { read: true },
        });
    }

    async unreadCount(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { customerId: true } });
        return prisma.notification.count({
            where: {
                OR: [
                    { userId },
                    ...(user?.customerId ? [{ customerId: user.customerId }] : []),
                ],
                read: false,
            },
        });
    }
}

export const notificationService = new NotificationService();
