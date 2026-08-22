'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Building, FileText, Receipt, Ticket } from 'lucide-react';

type Customer360Data = {
  customer: {
    id: string;
    organizationName: string;
    email?: string | null;
    contactPerson?: string | null;
  };
  openTickets: number;
  recentTickets: Array<{ id: string; subject: string; status: string }>;
  openInvoices: number;
  activeContracts: number;
  lastCsat?: number | null;
};

export function Customer360Strip({ customerId }: { customerId?: string | null }) {
  const { path, workspaceFetch } = useWorkspacePaths();

  const { data } = useQuery({
    queryKey: ['customer-360', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/customers/${customerId}/360`);
      if (!res.ok) return null;
      return res.json() as Promise<Customer360Data>;
    },
    staleTime: 30_000,
  });

  if (!customerId || !data) return null;

  return (
    <Card className="shadow-none border-dashed">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Building className="h-4 w-4" />
          <Link
            href={path(`/dashboard/customers/${data.customer.id}`)}
            className="hover:underline"
          >
            {data.customer.organizationName}
          </Link>
          {data.lastCsat != null && (
            <Badge variant="secondary" className="text-[10px]">
              CSAT {data.lastCsat}/5
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 grid gap-3 sm:grid-cols-3 text-xs">
        <div className="space-y-1">
          <p className="font-medium flex items-center gap-1 text-muted-foreground">
            <Ticket className="h-3 w-3" />
            Tickets ({data.openTickets} open)
          </p>
          {data.recentTickets.slice(0, 3).map((t) => (
            <Link
              key={t.id}
              href={path(`/dashboard/tickets/${t.id}`)}
              className="block truncate hover:underline"
            >
              {t.subject}
            </Link>
          ))}
          {!data.recentTickets.length && (
            <p className="text-muted-foreground">No recent tickets</p>
          )}
        </div>
        <div>
          <p className="font-medium flex items-center gap-1 text-muted-foreground">
            <Receipt className="h-3 w-3" />
            Invoices
          </p>
          <p className="mt-1">{data.openInvoices} unpaid / open</p>
        </div>
        <div>
          <p className="font-medium flex items-center gap-1 text-muted-foreground">
            <FileText className="h-3 w-3" />
            Contracts
          </p>
          <p className="mt-1">{data.activeContracts} active</p>
        </div>
      </CardContent>
    </Card>
  );
}
