'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from "next-auth/react";
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FullTableSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';
import { Building2, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CompanyDatabasePanel } from '@/components/settings/company/sections/database';

interface Company {
  id: string;
  name: string;
  website: string | null;
  slug?: string;
  /** CompanyStatus enum: PENDING | APPROVED | REJECTED */
  status: string;
  createdAt: string;
  admin?: {
    name: string;
    email: string;
  } | null;
  employees?: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
  }>;
}

interface ApiResponse {
  success: boolean;
  data: Company[];
  message?: string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: 'Pending approval',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300',
  },
};

function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return <Badge className={`${meta.className} ${className}`}>{meta.label}</Badge>;
}

const employeeCount = (company: Company) => {
  const n = company.employees?.length || 0;
  return `${n} employee${n === 1 ? '' : 's'}`;
};

const websiteHref = (website: string) =>
  /^https?:\/\//i.test(website) ? website : `https://${website}`;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dbCompany, setDbCompany] = useState<Company | null>(null);
  const { data: session } = useSession();
  const { toast } = useToast();

  const fetchCompanies = useCallback(async () => {
    setRefreshing(true);
    try {
      setError(null);
      const response = await fetch('/api/admin/companies');
      const result: ApiResponse | null = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to fetch companies');
      }

      setCompanies(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch companies');
      setCompanies([]);
    } finally {
      setIsInitialLoad(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleDelete = async (company: Company) => {
    const confirmToken = (company.slug || company.name || '').trim();
    if (!confirmToken) {
      toast({
        title: 'Error',
        description: 'Company has no slug or name to confirm deletion.',
        variant: 'destructive',
      });
      return;
    }

    const ok = await confirmAction({
      title: `Delete ${company.name}?`,
      description:
        'This permanently deletes the workspace and company-scoped data. Users who only belong to this company will also be deleted. Type the company slug to confirm.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      confirmText: confirmToken,
      confirmTextLabel: `Type "${confirmToken}" to confirm`,
    });
    if (!ok) return;

    setBusyId(company.id);
    try {
      const response = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'DELETE',
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || `Failed to delete company (HTTP ${response.status})`
        );
      }

      toast({
        title: 'Company deleted',
        description: `${company.name} and its data were removed.`,
      });

      fetchCompanies();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete company',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (company: Company, newStatus: 'APPROVED' | 'REJECTED') => {
    if (newStatus === 'REJECTED') {
      const ok = await confirmAction({
        title:
          company.status === 'APPROVED'
            ? `Suspend ${company.name}?`
            : `Reject ${company.name}?`,
        description:
          company.status === 'APPROVED'
            ? 'The workspace is marked rejected and its team loses access until it is approved again.'
            : 'The workspace stays blocked. You can approve it later.',
        confirmLabel: company.status === 'APPROVED' ? 'Suspend' : 'Reject',
        variant: 'destructive',
      });
      if (!ok) return;
    }

    setBusyId(company.id);
    try {
      const response = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error();

      setCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, status: newStatus } : c))
      );
      toast({
        title: newStatus === 'APPROVED' ? 'Company approved' : 'Company access removed',
        description:
          newStatus === 'APPROVED'
            ? `${company.name} can now use its workspace.`
            : `${company.name} is now marked rejected.`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update company status',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  /** Approve / reject actions that match the CompanyStatus enum. */
  const statusActions = (company: Company, className = '') => {
    const busy = busyId === company.id;
    if (company.status === 'APPROVED') {
      return (
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={busy}
          onClick={() => handleStatusChange(company, 'REJECTED')}
        >
          Suspend
        </Button>
      );
    }
    return (
      <>
        <Button
          size="sm"
          className={className}
          disabled={busy}
          onClick={() => handleStatusChange(company, 'APPROVED')}
        >
          Approve
        </Button>
        {company.status === 'PENDING' ? (
          <Button
            variant="outline"
            size="sm"
            className={className}
            disabled={busy}
            onClick={() => handleStatusChange(company, 'REJECTED')}
          >
            Reject
          </Button>
        ) : null}
      </>
    );
  };

  if (session?.user?.role !== 'SUPER_ADMIN') {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Super admins only"
        description="You don't have permission to manage platform companies."
      />
    );
  }

  const pendingCount = companies.filter((c) => c.status === 'PENDING').length;

  // Static page header: shown as-is while data loads (no skeleton for known text)
  const pageHeader = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All workspaces on the platform
          {pendingCount > 0 ? ` · ${pendingCount} awaiting approval` : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchCompanies()}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );

  if (isInitialLoad) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <FullTableSkeleton columnCount={5} rowCount={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <EmptyState
          icon={Building2}
          title="Couldn't load companies"
          description={error}
          actionLabel="Try again"
          onAction={() => fetchCompanies()}
          className="rounded-lg border"
        />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Workspaces appear here as soon as someone registers a company."
          className="rounded-lg border"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      {/* Phones: one card per company */}
      <div className="space-y-3 md:hidden">
        {companies.map((company) => (
          <Card key={company.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{company.name}</p>
                {company.slug ? (
                  <p className="truncate text-xs text-muted-foreground">/{company.slug}</p>
                ) : null}
              </div>
              <StatusBadge status={company.status} className="shrink-0" />
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <p className="truncate">
                {company.admin
                  ? `${company.admin.name} · ${company.admin.email}`
                  : 'No admin assigned'}
              </p>
              <p>
                {employeeCount(company)} · created{' '}
                {formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {statusActions(company, 'h-10')}
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setDbCompany(company)}
              >
                Database
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-10"
                disabled={busyId === company.id}
                onClick={() => handleDelete(company)}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-medium">{company.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {company.slug ? `/${company.slug}` : null}
                      {company.slug && company.website ? ' · ' : null}
                      {company.website ? (
                        <a
                          href={websiteHref(company.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {company.website.replace(/^https?:\/\//i, '')}
                        </a>
                      ) : null}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={company.status} />
                </TableCell>
                <TableCell>
                  {company.admin ? (
                    <div>
                      <div>{company.admin.name}</div>
                      <div className="text-sm text-muted-foreground">{company.admin.email}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No admin assigned</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{employeeCount(company)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {statusActions(company)}
                    <Button variant="outline" size="sm" onClick={() => setDbCompany(company)}>
                      Database
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busyId === company.id}
                      onClick={() => handleDelete(company)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!dbCompany} onOpenChange={(open) => !open && setDbCompany(null)}>
        <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Database — {dbCompany?.name ?? 'Company'}</DialogTitle>
          </DialogHeader>
          {dbCompany ? <CompanyDatabasePanel companyId={dbCompany.id} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
