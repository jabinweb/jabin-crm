'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardPage } from '@/components/layout/dashboard-page';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Loader2 } from 'lucide-react';

type PendingEmployee = {
  id: string;
  name: string;
  email: string;
  status?: string;
  createdAt?: string;
  company?: { name: string };
  user?: { email?: string | null; name?: string | null };
};

/**
 * Workspace-scoped approvals (employee registrations for this company).
 * Platform company/signup approvals stay on SUPER_ADMIN `/api/admin/approve`.
 */
export default function WorkspaceApprovalsPage() {
  const { workspaceFetch } = useWorkspacePaths();
  const [employees, setEmployees] = useState<PendingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await workspaceFetch('/api/pending/employee');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch pending employees');
      }
      setEmployees(Array.isArray(data) ? data : data.employees ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (actingId) return;
    setActingId(id);
    try {
      const response = await workspaceFetch('/api/pending/employee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action}`);
      }
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      toast.success(action === 'approve' ? 'Employee approved' : 'Registration rejected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardPage>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pending registrations…
        </div>
      </DashboardPage>
    );
  }

  if (error) {
    return (
      <DashboardPage>
        <p className="text-destructive">Error: {error}</p>
        <Button variant="outline" onClick={() => void fetchPending()}>
          Retry
        </Button>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pending approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review employee registration requests for this workspace.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">
                    {emp.name || emp.user?.name || '—'}
                  </TableCell>
                  <TableCell>{emp.email || emp.user?.email || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{emp.status || 'PENDING'}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actingId === emp.id}
                      onClick={() => void handleAction(emp.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={actingId === emp.id}
                      onClick={() => void handleAction(emp.id, 'reject')}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No pending employee registrations
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
