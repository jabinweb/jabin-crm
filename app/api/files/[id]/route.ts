import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthorization } from '@/lib/authorization';
import { AuditLogger } from '@/lib/audit';

export const DELETE = withAuthorization(
    async (req: NextRequest, { user }, routeContext) => {
        const auditLogger = new AuditLogger();

        try {
            const params = await routeContext?.params;
            if (!params) {
                return NextResponse.json(
                    { error: 'Invalid request' },
                    { status: 400 }
                );
            }

            const fileId = params.id;

            // Get file info before deletion
            const file = await prisma.file.findUnique({
                where: { id: fileId },
                select: {
                    id: true,
                    name: true,
                    filename: true,
                    folder: true,
                },
            });

            if (!file) {
                return NextResponse.json(
                    { error: 'File not found' },
                    { status: 404 }
                );
            }

            // Delete from database
            await prisma.file.delete({
                where: { id: fileId },
            });

            // Log deletion
            await auditLogger.logDelete('file', fileId, user.id, {
                filename: file.filename,
                folder: file.folder,
            });

            // Note: Physical file deletion from PHP server would need to be handled separately
            // if required. For now, we're just removing the database record.

            return NextResponse.json({
                success: true,
                message: 'File deleted from database',
            });

        } catch (error) {
            console.error('Error deleting file:', error);
            await auditLogger.logFailure('file', 'delete', user.id, error as Error);

            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    },
    { roles: ['admin'] }
);

export const GET = withAuthorization(
    async (req: NextRequest, context, routeContext) => {
        try {
            const params = await routeContext?.params;
            if (!params) {
                return NextResponse.json(
                    { error: 'Invalid request' },
                    { status: 400 }
                );
            }

            const file = await prisma.file.findUnique({
                where: { id: params.id },
                select: {
                    id: true,
                    name: true,
                    filename: true,
                    originalName: true,
                    mimeType: true,
                    size: true,
                    url: true,
                    path: true,
                    folder: true,
                    isPublic: true,
                    description: true,
                    metadata: true,
                    createdAt: true,
                    updatedAt: true,
                    uploadedBy: true,
                },
            });

            if (!file) {
                return NextResponse.json(
                    { error: 'File not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json({ file });

        } catch (error) {
            console.error('Error fetching file:', error);
            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    },
    { roles: ['admin', 'moderator'] }
);