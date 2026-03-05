import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AuditLogger } from '@/lib/audit';

export async function POST(request: NextRequest) {
    const auditLogger = new AuditLogger();

    try {
        // Check authentication
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const fileEntry = formData.get('file');
        const file = fileEntry instanceof File ? fileEntry : null;
        const folderEntry = formData.get('folder');
        const folder = typeof folderEntry === 'string' ? folderEntry : 'default';
        const descriptionEntry = formData.get('description');
        const description = typeof descriptionEntry === 'string' ? descriptionEntry : null;
        const isPublicEntry = formData.get('isPublic');
        const isPublic = typeof isPublicEntry === 'string' && isPublicEntry === 'true';

        // Validate file
        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate folder name
        if (!/^[a-zA-Z0-9_/-]+$/.test(folder)) {
            return NextResponse.json(
                { error: 'Invalid folder name' },
                { status: 400 }
            );
        }

        // Forward the file to PHP endpoint
        const phpUploadUrl = process.env.NEXT_PUBLIC_PHP_UPLOAD_URL || 'https://files.jabin.org/api/upload.php';

        const phpFormData = new FormData();
        phpFormData.append('file', file);
        phpFormData.append('folder', folder);

        const response = await fetch(phpUploadUrl, {
            method: 'POST',
            body: phpFormData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
            return NextResponse.json(
                { error: errorData.error || 'Upload failed' },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Save file record with synchronized schema fields
        const fileRecord = await prisma.file.create({
            data: {
                name: file.name,
                filename: data.filename || file.name,
                originalName: file.name,
                mimeType: file.type,
                size: file.size,
                url: data.url || data.file_url,
                path: data.path || `${folder}/${data.filename || file.name}`,
                folder: folder,
                userId: session.user.id,
                uploadedBy: session.user.id,
                isPublic: isPublic,
                description: description || null,
                metadata: {
                    uploadedAt: new Date().toISOString(),
                    phpResponse: data,
                },
            },
        });

        // Log successful upload
        await auditLogger.logCreate('file', fileRecord.id, session.user.id, {
            filename: fileRecord.filename,
            folder: folder,
            size: file.size,
        });

        return NextResponse.json({
            success: true,
            fileId: fileRecord.id,
            filename: fileRecord.filename,
            url: fileRecord.url,
            path: fileRecord.path,
            size: fileRecord.size,
            mimeType: fileRecord.mimeType,
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}