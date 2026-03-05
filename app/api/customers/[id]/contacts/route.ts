import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { customerService } from '@/lib/crm/customer-service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.json();

        if (!data.name) {
            return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });
        }

        const contact = await customerService.addContact(id, data);

        return NextResponse.json(contact, { status: 201 });
    } catch (error) {
        console.error('Error adding contact:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
