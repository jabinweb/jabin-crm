'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Check } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type Workspace = { id: string; name: string; slug: string; logo: string | null; isHome: boolean };

/**
 * Dropdown items for moving between workspaces. Renders nothing for people who
 * belong to a single workspace. Place inside a <DropdownMenuContent>.
 */
export function WorkspaceSwitcherItems() {
  const { data: session } = useSession();
  const { slug } = useWorkspacePaths();

  const { data } = useQuery({
    queryKey: ['user-workspaces', session?.user?.id],
    queryFn: async () => {
      const res = await fetch('/api/user/workspaces');
      if (!res.ok) return { workspaces: [] as Workspace[] };
      return (await res.json()) as { workspaces: Workspace[] };
    },
    enabled: !!session?.user?.id && session.user.role !== 'CUSTOMER',
    staleTime: 5 * 60_000,
  });

  const workspaces = data?.workspaces ?? [];
  if (workspaces.length < 2) return null;

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Workspaces
      </DropdownMenuLabel>
      {workspaces.map((workspace) => {
        const active = workspace.slug === slug;
        return (
          <DropdownMenuItem key={workspace.id} asChild disabled={active}>
            {/* Full navigation, not a client transition: every cached query belongs to the old workspace */}
            <a href={`/${workspace.slug}/dashboard`}>
              <Building2 className="mr-2 h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {active ? <Check className="ml-2 h-4 w-4" /> : null}
            </a>
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
    </>
  );
}
