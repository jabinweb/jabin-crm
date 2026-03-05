import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthorization } from '@/lib/authorization';

export const GET = withAuthorization(
    async (req: NextRequest) => {
        try {
            const { searchParams } = new URL(req.url);
            const folder = searchParams.get('folder');
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '100');
            const skip = (page - 1) * limit;

            // Build where clause
            const where: any = {};
            if (folder && folder !== 'all') {
                where.folder = folder;
            }

            // Fetch files
            const [files, total] = await Promise.all([
                prisma.file.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        filename: true,
                        originalName: true,
                        mimeType: true,
                        size: true,
                        url: true,
                        folder: true,
                        isPublic: true,
                        description: true,
                        createdAt: true,
                        uploadedBy: true,
                    },
                }),
                prisma.file.count({ where }),
            ]);

            return NextResponse.json({
                files,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            });

        } catch (error) {
            console.error('Error fetching files:', error);
            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    },
    { roles: ['admin', 'moderator'] }
);