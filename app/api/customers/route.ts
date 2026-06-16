import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { customerService } from '@/lib/crm/customer-service';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let companyId: string | undefined;
        try {
            const ctx = await resolveCompanyContextFromRequest(session, request);
            companyId = ctx.companyId;
        } catch (e) {
            if (!(e instanceof TenantError) || e.status !== 400) throw e;
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
            companyId,
        });

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof TenantError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
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

        const { companyId } = await resolveCompanyContextFromRequest(session, request);
        const data = await request.json();

        if (!data.organizationName || !data.contactPerson) {
            return NextResponse.json({ error: 'Organization name and contact person are required' }, { status: 400 });
        }

        const customer = await customerService.createCustomer({
            ...data,
            companyId,
        });

        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        if (error instanceof TenantError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error creating customer:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
