'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { FullTableSkeleton, PageHeaderSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';
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

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbCompany, setDbCompany] = useState<Company | null>(null);
  const { data: session } = useSession();
  const { toast } = useToast();

  const fetchCompanies = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/companies');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch companies');
      }
      
      setCompanies(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch companies');
      setCompanies([]);
      
      toast({
        title: "Error",
        description: "Failed to fetch companies. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsInitialLoad(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleEdit = async (companyId: string) => {
    router.push(`/admin/companies?focus=${encodeURIComponent(companyId)}`);
    toast({
      title: 'Company',
      description: 'Use status actions below, or open Subscriptions to grant a plan for this workspace.',
    });
  };

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
      title: 'Delete this company?',
      description:
        'This permanently deletes the workspace and company-scoped data. Users who only belong to this company will also be deleted. Type the company slug to confirm.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      confirmText: confirmToken,
      confirmTextLabel: `Type "${confirmToken}" to confirm`,
    });
    if (!ok) return;

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
        title: 'Success',
        description: 'Company deleted successfully',
      });

      fetchCompanies();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete company',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (companyId: string, newStatus: string) => {
    const response = await fetch(`/api/admin/companies/${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    
    if (response.ok) {
      setCompanies(companies.map(company => 
        company.id === companyId ? { ...company, status: newStatus } : company
      ));
    }
  };

  if (session?.user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (isInitialLoad) {
    return (
      <div className="p-8 space-y-6">
        <PageHeaderSkeleton />
        <FullTableSkeleton columnCount={5} rowCount={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center text-red-500">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All workspaces on the platform
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchCompanies()}>
          Refresh
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  {error ? 'Failed to load companies' : 'No companies found'}
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>{company.name}</TableCell>
                  <TableCell>{company.website}</TableCell>
                  <TableCell>
                    <Badge variant={company.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {company.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {company.admin ? (
                      <div>
                        <div>{company.admin.name}</div>
                        <div className="text-sm text-muted-foreground">{company.admin.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">No admin assigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.employees?.length || 0} employees
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(company.id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDbCompany(company)}
                      >
                        Database
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleStatusChange(
                            company.id,
                            company.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                          )
                        }
                      >
                        {company.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(company)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!dbCompany} onOpenChange={(open) => !open && setDbCompany(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Database — {dbCompany?.name ?? 'Company'}
            </DialogTitle>
          </DialogHeader>
          {dbCompany ? (
            <CompanyDatabasePanel companyId={dbCompany.id} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
