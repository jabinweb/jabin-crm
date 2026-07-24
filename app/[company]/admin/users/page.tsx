'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardPage } from '@/components/layout/dashboard-page';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton, PageHeaderSkeleton } from '@/components/loading';
import { Plus } from 'lucide-react';

type WorkspaceUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  primaryCompany?: {
    name: string;
    status: string;
  } | null;
  companies?: Array<{
    name: string;
    status: string;
  }>;
};

export default function WorkspaceUsersPage() {
  const { workspaceFetch } = useWorkspacePaths();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'SALES',
    password: '',
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await workspaceFetch('/api/workspace/users');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch users');
      }

      const list = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result)
          ? result
          : [];
      setUsers(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const invite = async () => {
    if (!form.email.trim()) {
      toast.error('Email is required');
      return;
    }
    setInviting(true);
    setTempPassword(null);
    try {
      const res = await workspaceFetch('/api/workspace/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email: form.email.trim(),
          role: form.role,
          password: form.password.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to invite user');
      }
      const payload = data.data || data;
      if (payload.temporaryPassword) {
        setTempPassword(payload.temporaryPassword);
        toast.success('User created — copy the temporary password');
      } else if (payload.alreadyMember) {
        toast.success('Existing user added to this workspace');
        setInviteOpen(false);
      } else {
        toast.success('User invited');
        setInviteOpen(false);
      }
      setForm({ name: '', email: '', role: 'SALES', password: '' });
      void fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <DashboardPage>
        <PageHeaderSkeleton />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <FullTableSkeleton columnCount={6} rowCount={5} />
          </CardContent>
        </Card>
      </DashboardPage>
    );
  }

  if (error) {
    return (
      <DashboardPage>
        <p className="text-destructive">Error: {error}</p>
        <Button variant="outline" onClick={() => void fetchUsers()}>
          Retry
        </Button>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace users</h1>
          <p className="text-sm text-muted-foreground">
            People with access to this company workspace.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Invite teammate
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Company status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name || '—'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.primaryCompany?.name || user.companies?.[0]?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {user.primaryCompany ? (
                        <Badge
                          variant={
                            user.primaryCompany.status === 'APPROVED' ? 'default' : 'secondary'
                          }
                        >
                          {user.primaryCompany.status}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found in this workspace
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) setTempPassword(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite teammate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(role) => setForm((f) => ({ ...f, role }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SALES">Sales</SelectItem>
                  <SelectItem value="SUPPORT_MANAGER">Support manager</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Password (optional)</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Auto-generated if empty"
              />
            </div>
            {tempPassword && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <p className="font-medium">Temporary password</p>
                <code className="text-xs break-all">{tempPassword}</code>
                <p className="text-xs text-muted-foreground">
                  Share this once — it will not be shown again.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Close
            </Button>
            <Button onClick={() => void invite()} disabled={inviting}>
              {inviting ? 'Inviting…' : 'Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
