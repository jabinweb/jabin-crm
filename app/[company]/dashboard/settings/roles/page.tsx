'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { TableSkeleton } from '@/components/loading';

type RolesResponse = {
  permissions: string[];
  roleMatrix: Record<string, string[]>;
  members: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    userStatus: string;
  }>;
};

const ROLE_OPTIONS = ['ADMIN', 'SALES', 'SUPPORT_MANAGER', 'TECHNICIAN'] as const;

export default function RolesPermissionsPage() {
  const { workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['workspace-roles'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/workspace/roles');
      if (!res.ok) throw new Error('Failed to load roles');
      return (await res.json()) as RolesResponse;
    },
  });

  const changeRole = async (userId: string, role: string) => {
    try {
      const res = await workspaceFetch('/api/workspace/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update role');
      }
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['workspace-roles'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    }
  };

  const roles = Object.keys(data?.roleMatrix || {});
  const permissions = data?.permissions || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
        <p className="text-sm text-muted-foreground">
          Read-only permission matrix by role. Assign teammate roles below — changes sync to RBAC.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permission matrix</CardTitle>
          <CardDescription>Catalog permissions granted to each workspace role.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columnCount={5} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role} className="text-center">
                        {role.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm}>
                      <TableCell className="font-mono text-xs">{perm}</TableCell>
                      {roles.map((role) => {
                        const granted = data?.roleMatrix[role]?.includes(perm);
                        return (
                          <TableCell key={role} className="text-center">
                            {granted ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teammates</CardTitle>
          <CardDescription>Change role for workspace members.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columnCount={4} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.members || []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name || '—'}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.userStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
