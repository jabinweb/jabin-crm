import { prisma } from '@/lib/prisma';
import { NotificationType } from '@prisma/client';
import { getUserPrimaryCompanyId } from '@/lib/auth/company-membership';
import { publishRealtime } from '@/lib/realtime/hub';
import { REALTIME_EVENTS } from '@/lib/realtime/events';

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
        const notification = await prisma.notification.create({
            data: {
                type: params.type,
                title: params.title,
                body: params.body,
                userId: params.userId ?? null,
                customerId: params.customerId ?? null,
                metadata: params.metadata ?? {},
            },
        });

        void this.publishCreated(notification, params);

        return notification;
    }

    private async publishCreated(
        notification: {
            id: string;
            type: NotificationType;
            title: string;
            body: string;
            userId: string | null;
            metadata: unknown;
        },
        params: CreateNotificationParams
    ) {
        try {
            let companyId =
                typeof params.metadata?.companyId === 'string'
                    ? params.metadata.companyId
                    : null;

            if (!companyId && params.userId) {
                companyId = await getUserPrimaryCompanyId(params.userId);
            }
            if (!companyId && params.customerId) {
                const customer = await prisma.customer.findUnique({
                    where: { id: params.customerId },
                    select: { companyId: true },
                });
                companyId = customer?.companyId ?? null;
            }

            if (!companyId) return;

            await publishRealtime(
                REALTIME_EVENTS.NOTIFICATION_CREATED,
                companyId,
                {
                    id: notification.id,
                    notificationType: notification.type,
                    title: notification.title,
                    body: notification.body,
                    metadata: notification.metadata,
                },
                params.userId
            );
        } catch (err) {
            console.error('[notificationService.publishCreated]', err);
        }
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
