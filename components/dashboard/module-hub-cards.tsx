'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Activity,
  ArrowRight,
  Briefcase,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Package,
  Settings,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { getAvailableModules } from '@/lib/navigation/modules';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  Activity,
  Users,
  LifeBuoy,
  Mail,
  Briefcase,
  Package,
  Settings,
  ShieldAlert,
};

export function ModuleHubCards({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const role = session?.user?.role || 'SALES';
  const { path } = useWorkspacePaths();
  const { data: workspaceData } = useWorkspaceConfig();
  const vertical = workspaceData?.config.businessVertical ?? null;
  const features = workspaceData?.config.features as
    | Record<string, boolean | undefined>
    | undefined;

  const modules = getAvailableModules({
    role,
    vertical,
    features,
  });

  if (modules.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Modules</h2>
        {!compact ? (
          <p className="text-sm text-muted-foreground">
            Open a workspace area — the sidebar focuses on that module.
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const Icon = ICON_MAP[m.icon] || LayoutDashboard;
          return (
            <Link key={m.id} href={path(m.href)} className="block">
              <Card className="h-full border-border shadow-none transition-colors hover:bg-muted/50">
                <CardHeader className="flex-row items-center gap-3 space-y-0 p-3.5">
                  <div className="rounded-md bg-muted p-2 text-foreground/70">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold">{m.label}</CardTitle>
                    <CardDescription className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {m.description}
                    </CardDescription>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
