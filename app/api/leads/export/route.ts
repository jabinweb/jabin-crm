import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';

export async function GET(request: NextRequest) {
  try {
    const session = await withModuleAccess('LEADS');

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const search = searchParams.get('search') || '';
    const industry = searchParams.get('industry') || '';

    const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];

    const where = {
      userId: session.user.id,
      ...(ids.length > 0 && { id: { in: ids } }),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(industry && { industry: { contains: industry, mode: 'insensitive' } }),
    };

    const leads = await prisma.lead.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'csv') {
      const csvPath = path.join(process.cwd(), 'tmp', `leads-${Date.now()}.csv`);

      // Ensure tmp directory exists
      const tmpDir = path.dirname(csvPath);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const csvWriter = createObjectCsvWriter({
        path: csvPath,
        header: [
          { id: 'companyName', title: 'Company Name' },
          { id: 'contactName', title: 'Contact Name' },
          { id: 'email', title: 'Email' },
          { id: 'phone', title: 'Phone' },
          { id: 'website', title: 'Website' },
          { id: 'industry', title: 'Industry' },
          { id: 'employeeCount', title: 'Employee Count' },
          { id: 'address', title: 'Address' },
          { id: 'linkedinUrl', title: 'LinkedIn' },
          { id: 'source', title: 'Source' },
          { id: 'createdAt', title: 'Created At' },
        ],
      });

      await csvWriter.writeRecords(leads);

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      fs.unlinkSync(csvPath); // Clean up

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="leads.csv"',
        },
      });
    }

    // Default to JSON
    return NextResponse.json(leads);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error exporting leads:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
