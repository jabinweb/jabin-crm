import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { clientHistoryService } from '@/lib/crm/client-history-service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'csv';

        if (format === 'csv') {
            const csv = await clientHistoryService.exportCustomerHistoryToCSV(id);
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="customer-history-${id}.csv"`
                }
            });
        }

        const history = await clientHistoryService.getFormattedHistory(id);
        return NextResponse.json(history);
    } catch (error) {
        console.error('Error exporting history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
