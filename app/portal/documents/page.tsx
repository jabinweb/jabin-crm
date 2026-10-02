'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Download, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { FullTableSkeleton } from '@/components/loading';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';

type PortalDocument = {
  id: string;
  type: 'invoice' | 'quotation' | 'contract';
  title: string;
  number: string | null;
  status: string;
  currency?: string | null;
  amount?: number | null;
  date: string;
  href: string;
  downloadHref?: string;
};

function typeLabel(type: PortalDocument['type']) {
  if (type === 'invoice') return 'Invoice';
  if (type === 'quotation') return 'Quote';
  return 'Contract';
}

function DocumentsList() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['portal-documents'],
    queryFn: async () => {
      const res = await fetch('/api/portal/documents');
      if (!res.ok) throw new Error('Failed to load documents');
      return res.json() as Promise<{ documents: PortalDocument[] }>;
    },
  });

  if (isLoading) {
    return <FullTableSkeleton columnCount={5} rowCount={5} />;
  }

  const documents = data?.documents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/portal')} className="-ml-3 rounded-none">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Invoices, quotations, and service contracts for your account.
          </p>
        </div>
      </div>

      <Card className="border-none bg-white dark:bg-slate-900 shadow-none overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y md:hidden">
            {documents.length === 0 ? (
              <p className="py-12 text-center text-sm italic text-muted-foreground">No documents yet.</p>
            ) : (
              documents.map((doc) => (
                <div key={`${doc.type}-${doc.id}`} className="flex items-start gap-3 p-4">
                  <Link href={doc.href} className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{doc.number || doc.title}</p>
                    {doc.number ? (
                      <p className="truncate text-xs text-muted-foreground">{doc.title}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{typeLabel(doc.type)}</Badge>
                      <Badge variant="outline">{doc.status}</Badge>
                      <span>{new Date(doc.date).toLocaleDateString()}</span>
                      {doc.amount != null && doc.currency ? (
                        <span className="font-medium tabular-nums text-foreground">
                          {formatCurrency(doc.amount, doc.currency as never)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  {doc.downloadHref ? (
                    <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" asChild>
                      <a href={doc.downloadHref} target="_blank" rel="noreferrer" aria-label="Download">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="pl-6">Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                    No documents yet.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={`${doc.type}-${doc.id}`} className="border-slate-50 dark:border-slate-800">
                    <TableCell className="pl-6">
                      {doc.type === 'contract' ? (
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            {doc.title}
                          </div>
                          {doc.number ? (
                            <div className="text-xs text-muted-foreground">{doc.number}</div>
                          ) : null}
                        </div>
                      ) : (
                        <Link href={doc.href} className="hover:underline">
                          <div className="font-medium">{doc.number || doc.title}</div>
                          <div className="text-xs text-muted-foreground">{doc.title}</div>
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabel(doc.type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(doc.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {doc.amount != null && doc.currency
                        ? formatCurrency(doc.amount, doc.currency as never)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={doc.href}>Open</Link>
                        </Button>
                        {doc.downloadHref ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={doc.downloadHref} target="_blank" rel="noreferrer">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalDocumentsPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Documents not available"
      description="Your provider has not enabled the customer portal for documents."
    >
      <DocumentsList />
    </PortalFeatureGuard>
  );
}
