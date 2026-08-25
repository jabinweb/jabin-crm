'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionSkeleton } from '@/components/loading';
import { FileText } from 'lucide-react';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';

type PortalContract = {
  id: string;
  type: string;
  status: string;
  contractNumber: string | null;
  title: string;
  startDate: string;
  endDate: string;
  annualValue: number | null;
  currency: string;
};

function ContractsList() {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['portal-contracts'],
    queryFn: async () => {
      const res = await fetch('/api/portal/contracts');
      if (!res.ok) throw new Error('Failed to load contracts');
      return (await res.json()) as PortalContract[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SectionSkeleton lines={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active service agreements and coverage details.
        </p>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No contracts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Service contracts linked to your account will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contracts.map((c) => (
            <Link key={c.id} href={`/portal/contracts/${c.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <Badge variant="secondary">{c.status}</Badge>
                  </div>
                  {c.contractNumber ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.contractNumber}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>
                    {c.type} ·{' '}
                    {new Date(c.startDate).toLocaleDateString()} →{' '}
                    {new Date(c.endDate).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalContractsPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Contracts not available"
      description="Service contracts are not enabled for your portal."
    >
      <ContractsList />
    </PortalFeatureGuard>
  );
}
