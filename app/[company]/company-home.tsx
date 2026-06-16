'use client';

import { useCompany } from '@/contexts/company-context';

export function CompanyHome() {
  const { company } = useCompany();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
      <p className="text-muted-foreground mb-8">
        Company Management Dashboard
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
          <p className="text-2xl font-bold mt-1">{company.status}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Slug</h3>
          <p className="text-2xl font-bold mt-1">/{company.slug}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Website</h3>
          <p className="text-2xl font-bold mt-1 truncate">{company.website ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
