import { prisma } from '@/lib/prisma';

export interface AuditLogEntry {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
    status?: 'success' | 'failure';
    errorMessage?: string;
}

export class AuditLogger {
    /**
     * Log an action to the audit trail
     */
    async log(entry: AuditLogEntry): Promise<void> {
        try {
            await prisma.auditLog.create({
                data: {
                    userId: entry.userId,
                    action: entry.action,
                    resource: entry.resource,
                    resourceId: entry.resourceId,
                    changes: entry.changes || {},
                    metadata: entry.metadata || {},
                    status: entry.status || 'success',
                    errorMessage: entry.errorMessage
                }
            });
        } catch (error) {
            // Don't throw - audit logging should not break the application
            console.error('Failed to write audit log:', error);
        }
    }

    /**
     * Log a successful create operation
     */
    async logCreate(
        resource: string,
        resourceId: string,
        userId: string,
        data: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId,
            action: `${resource}:create`,
            resource,
            resourceId,
            changes: { created: data },
            status: 'success'
        });
    }

    /**
     * Log a successful update operation
     */
    async logUpdate(
        resource: string,
        resourceId: string,
        userId: string,
        oldData: Record<string, any>,
        newData: Record<string, any>
    ): Promise<void> {
        const changes: Record<string, any> = {};

        // Track what changed
        for (const key of Object.keys(newData)) {
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changes[key] = {
                    from: oldData[key],
                    to: newData[key]
                };
            }
        }

        await this.log({
            userId,
            action: `${resource}:update`,
            resource,
            resourceId,
            changes,
            status: 'success'
        });
    }

    /**
     * Log a successful delete operation
     */
    async logDelete(
        resource: string,
        resourceId: string,
        userId: string,
        data: Record<string, any>
    ): Promise<void> {
        await this.log({
            userId,
            action: `${resource}:delete`,
            resource,
            resourceId,
            changes: { deleted: data },
            status: 'success'
        });
    }

    /**
     * Log a failed operation
     */
    async logFailure(
        resource: string,
        action: string,
        userId: string | undefined,
        error: Error | unknown,
        metadata?: Record<string, any>
    ): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.log({
            userId,
            action,
            resource,
            status: 'failure',
            errorMessage,
            metadata
        });
    }
}