'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Check, Loader2, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { TableSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';
import { humanizeEnum } from '@/lib/format/humanize';

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

/** Plain-language labels for the RBAC catalog keys. */
const PERMISSION_LABELS: Record<string, string> = {
  'leads:read': 'View leads',
  'leads:write': 'Create & edit leads',
  'tickets:read': 'View tickets',
  'tickets:write': 'Create & edit tickets',
  'projects:read': 'View projects',
  'projects:write': 'Create & edit projects',
  'inventory:read': 'View inventory',
  'inventory:write': 'Manage inventory',
  'finance:read': 'View finance',
  'finance:write': 'Manage finance',
  'hr:admin': 'Manage people & HR',
  'billing:manage': 'Manage billing & plan',
  'platform:admin': 'Platform administration',
};

const permissionLabel = (perm: string) => PERMISSION_LABELS[perm] ?? humanizeEnum(perm.replace(':', ' '));

const STATUS_TONES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300',
  PENDING: 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={STATUS_TONES[status] ?? 'bg-muted text-muted-foreground hover:bg-muted'}>
      {humanizeEnum(status)}
    </Badge>
  );
}

export default function RolesPermissionsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workspace-roles', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/workspace/roles');
      if (!res.ok) throw new Error('Failed to load roles');
      return (await res.json()) as RolesResponse;
    },
  });

  const changeRole = async (member: RolesResponse['members'][number], role: string) => {
    if (role === member.role) return;
    const isSelf = member.id === session?.user?.id;
    const name = member.name || member.email || 'this teammate';

    if (isSelf || role === 'ADMIN' || member.role === 'ADMIN') {
      const ok = await confirmAction({
        title: isSelf
          ? `Change your own role to ${humanizeEnum(role)}?`
          : role === 'ADMIN'
            ? `Make ${name} a workspace admin?`
            : `Remove admin access from ${name}?`,
        description: isSelf
          ? 'You may lose access to workspace settings, including this page.'
          : role === 'ADMIN'
            ? 'Admins can change settings, billing, and every teammate’s role.'
            : `${name} will no longer be able to manage workspace settings.`,
        confirmLabel: 'Change role',
        variant: isSelf || member.role === 'ADMIN' ? 'destructive' : 'default',
      });
      if (!ok) return;
    }

    setPendingUserId(member.id);
    try {
      const res = await workspaceFetch('/api/workspace/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update role');
      }
      toast.success(`${name} is now ${humanizeEnum(role).toLowerCase()}`);
      await queryClient.invalidateQueries({ queryKey: ['workspace-roles', slug] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setPendingUserId(null);
    }
  };

  const roles = Object.keys(data?.roleMatrix || {});
  const permissions = data?.permissions || [];
  const members = data?.members || [];

  const roleSelect = (member: RolesResponse['members'][number], className = '') => (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        aria-label={`Role for ${member.name || member.email || 'teammate'}`}
        className="flex h-10 w-full min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:w-auto"
        value={member.role}
        disabled={pendingUserId === member.id}
        onChange={(e) => void changeRole(member, e.target.value)}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {humanizeEnum(r)}
          </option>
        ))}
      </select>
      {pendingUserId === member.id ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Saving" />
      ) : null}
    </div>
  );

  const errorState = (
    <EmptyState
      icon={ShieldCheck}
      title="Couldn't load roles"
      description="Something went wrong while fetching roles and teammates."
      actionLabel="Try again"
      onAction={() => void refetch()}
      className="py-8"
    />
  );

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
        <p className="text-sm text-muted-foreground">
          See what each role can do, and change a teammate&apos;s role below.
        </p>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">Teammates</CardTitle>
          <CardDescription>Role changes take effect the next time they load a page.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columnCount={4} />
          ) : isError ? (
            errorState
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No teammates yet"
              description="Invite your team; they show up here once they join."
              actionLabel="Invite teammate"
              actionHref={path('/dashboard/employees/new')}
              className="py-8"
            />
          ) : (
            <>
              {/* Phones: one card per teammate */}
              <div className="divide-y rounded-md border md:hidden">
                {members.map((m) => (
                  <div key={m.id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name || 'Unnamed'}</p>
                        <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                      </div>
                      <StatusBadge status={m.userStatus} />
                    </div>
                    {roleSelect(m)}
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
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
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name || 'Unnamed'}</TableCell>
                        <TableCell className="break-all">{m.email}</TableCell>
                        <TableCell>
                          <StatusBadge status={m.userStatus} />
                        </TableCell>
                        <TableCell>{roleSelect(m)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">What each role can do</CardTitle>
          <CardDescription>Built-in permissions per role (read-only).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columnCount={5} />
          ) : isError ? (
            errorState
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[11rem]">Permission</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role} className="whitespace-nowrap text-center">
                        {humanizeEnum(role)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm}>
                      <TableCell className="text-sm">{permissionLabel(perm)}</TableCell>
                      {roles.map((role) => {
                        const granted = data?.roleMatrix[role]?.includes(perm);
                        return (
                          <TableCell key={role} className="text-center">
                            {granted ? (
                              <Check
                                className="mx-auto h-4 w-4 text-green-600 dark:text-green-400"
                                aria-label="Allowed"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground" aria-label="Not allowed">
                                —
                              </span>
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
    </div>
  );
}
