'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ChevronLeft, FileWarning } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { humanizeStatus } from '@/lib/portal/status-label';
import { SectionSkeleton } from '@/components/loading';
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
  includesParts: boolean;
  visitLimit: number | null;
  notes: string | null;
  equipment: {
    id: string;
    serialNumber: string;
    product: { name: string } | null;
  } | null;
};

function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: contract, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['portal-contract', id],
    queryFn: async () => {
      const res = await fetch(`/api/portal/contracts/${id}`);
      if (!res.ok) throw new Error('Failed to load contract');
      return res.json() as Promise<PortalContract>;
    },
  });

  const backLink = (
    <Button variant="ghost" size="icon" asChild className="-ml-3 rounded-none">
      <Link href="/portal/documents" aria-label="Back to documents">
        <ChevronLeft className="h-4 w-4" />
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {backLink}
        <SectionSkeleton lines={8} className="py-4" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="space-y-4">
        {backLink}
        <EmptyState
          icon={FileWarning}
          title="We couldn't open this contract"
          description="It may have been removed, or the connection dropped. Try again, or go back to your documents."
          actionLabel={isRefetching ? 'Retrying…' : 'Try again'}
          onAction={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col items-start gap-2">
        {backLink}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight break-words min-w-0">{contract.title}</h1>
            <Badge variant="outline">{humanizeStatus(contract.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {humanizeStatus(contract.type)}
            {contract.contractNumber ? ` · ${contract.contractNumber}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage</CardTitle>
            <CardDescription>
              {format(new Date(contract.startDate), 'd MMM yyyy')} –{' '}
              {format(new Date(contract.endDate), 'd MMM yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Includes parts</span>
              <span>{contract.includesParts ? 'Yes' : 'No'}</span>
            </div>
            {contract.visitLimit != null ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visits included</span>
                <span>{contract.visitLimit}</span>
              </div>
            ) : null}
            {contract.annualValue != null ? (
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Annual value</span>
                <span>{formatCurrency(contract.annualValue, contract.currency as never)}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked asset</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {contract.equipment ? (
              <div className="space-y-1">
                <p className="font-medium">{contract.equipment.product?.name || 'Equipment'}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  SN: {contract.equipment.serialNumber}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No equipment linked to this contract.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {contract.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{contract.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function PortalContractPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Contracts not available"
      description="Your provider has not enabled the customer portal for contracts."
    >
      <ContractDetail />
    </PortalFeatureGuard>
  );
}
