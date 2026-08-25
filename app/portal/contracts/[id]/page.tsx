'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
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
  const router = useRouter();

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['portal-contract', id],
    queryFn: async () => {
      const res = await fetch(`/api/portal/contracts/${id}`);
      if (!res.ok) throw new Error('Failed to load contract');
      return res.json() as Promise<PortalContract>;
    },
  });

  if (isLoading) {
      return <SectionSkeleton lines={8} className="py-4" />;
  }

  if (error || !contract) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-muted-foreground">Contract not found.</p>
        <Button variant="outline" asChild>
          <Link href="/portal/documents">Back to documents</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/portal/documents')}
          className="rounded-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{contract.title}</h1>
            <Badge variant="outline">{contract.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {contract.type}
            {contract.contractNumber ? ` · ${contract.contractNumber}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage</CardTitle>
            <CardDescription>
              {new Date(contract.startDate).toLocaleDateString()} –{' '}
              {new Date(contract.endDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Includes parts</span>
              <span>{contract.includesParts ? 'Yes' : 'No'}</span>
            </div>
            {contract.visitLimit != null ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visit limit</span>
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
