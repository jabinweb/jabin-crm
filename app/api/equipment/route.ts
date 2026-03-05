import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { productService } from '@/lib/crm/product-service';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');

        if (!customerId) {
            return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
        }

        const installations = await productService.getCustomerEquipment(customerId);

        return NextResponse.json(installations);
    } catch (error) {
        console.error('Error fetching equipment:', error);
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

        if (!data.productId || !data.customerId) {
            return NextResponse.json({ error: 'Product ID and Customer ID are required' }, { status: 400 });
        }

        const installation = await productService.installEquipment(data);

        return NextResponse.json(installation, { status: 201 });
    } catch (error) {
        console.error('Error recording installation:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
