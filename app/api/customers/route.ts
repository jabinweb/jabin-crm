import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { customerService } from '@/lib/crm/customer-service';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || undefined;
        const city = searchParams.get('city') || undefined;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const result = await customerService.listCustomers({
            search,
            city,
            page,
            limit,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching customers:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.json();

        // Basic validation
        if (!data.hospitalName || !data.contactPerson) {
            return NextResponse.json({ error: 'Hospital name and contact person are required' }, { status: 400 });
        }

        const customer = await customerService.createCustomer(data);

        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        console.error('Error creating customer:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
