'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LifeBuoy,
  BookOpen,
  MessageSquare,
  Users,
  Ticket,
  BarChart3,
  Inbox,
  Clock,
  Zap,
  Lock,
} from 'lucide-react';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';
import { StatCardsSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

const modules: Array<{
  title: string;
  description: string;
  path: string;
  icon: typeof Ticket;
  feature: FeatureModuleKey;
  /** Same roles as the matching nav item (lib/navigation/modules.ts). */
  roles: string[];
}> = [
  {
    title: 'Omnichannel inbox',
    description: 'Unified queue for email, chat, portal, phone, and WhatsApp tickets.',
    path: '/dashboard/support/inbox',
    icon: Inbox,
    feature: 'SUPPORT_INBOX',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
  },
  {
    title: 'SLA policies',
    description: 'Configure first-response and resolution targets per priority level.',
    path: '/dashboard/support/sla-policies',
    icon: Clock,
    feature: 'SUPPORT_SLA',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'],
  },
  {
    title: 'Ticket queue',
    description: 'Classic ticket list with filters and assignment.',
    path: '/dashboard/tickets',
    icon: LifeBuoy,
    feature: 'TICKETS',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'],
  },
  {
    title: 'Knowledge base',
    description: 'Publish help articles for customers across any industry or product line.',
    path: '/dashboard/support/knowledge',
    icon: BookOpen,
    feature: 'SUPPORT_KNOWLEDGE',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'],
  },
  {
    title: 'Canned responses',
    description: 'Reusable reply templates for faster, consistent answers.',
    path: '/dashboard/support/canned-responses',
    icon: MessageSquare,
    feature: 'SUPPORT_CANNED',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'],
  },
  {
    title: 'Agent groups',
    description: 'Route tickets to billing, technical, or regional support teams.',
    path: '/dashboard/support/groups',
    icon: Users,
    feature: 'SUPPORT_GROUPS',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'],
  },
  {
    title: 'Support analytics',
    description: 'SLA compliance, CSAT, channel volume, and ticket trends.',
    path: '/dashboard/support/analytics',
    icon: BarChart3,
    feature: 'TICKETS',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'],
  },
  {
    title: 'Automation rules',
    description: 'Auto-tag, notify, and route tickets on create or status change.',
    path: '/dashboard/support/automation',
    icon: Zap,
    feature: 'TICKETS',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'],
  },
  {
    title: 'Customer accounts',
    description: 'Manage organizations, industries, and portal users — any vertical.',
    path: '/dashboard/customers',
    icon: LifeBuoy,
    feature: 'TICKETS',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
  },
];

export default function SupportDeskHubPage() {
  const { path } = useWorkspacePaths();
  const { data: session } = useSession();
  const role = session?.user?.role ?? '';
  const [moduleMap, setModuleMap] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    fetch('/api/features/me')
      .then((res) => (res.ok ? res.json() : { modules: {} }))
      .then((data) => setModuleMap(data.modules ?? {}))
      .catch(() => setModuleMap({}));
  }, []);

  const visible = modules.filter(
    (mod) => moduleMap?.[mod.feature] === true && mod.roles.includes(role)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Support desk</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Tickets, live conversations, help articles, and the tools your agents use to resolve
          them — all in one place.
        </p>
      </div>

      {moduleMap === null ? (
        <StatCardsSkeleton count={6} />
      ) : visible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Support desk not available
            </CardTitle>
            <CardDescription>
              Upgrade your subscription to access ticketing and support tools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={path('/dashboard/settings/subscription')}>View plans</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((mod) => (
            <Card key={mod.path} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <mod.icon className="h-5 w-5 text-primary" />
                  {mod.title}
                </CardTitle>
                <CardDescription>{mod.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href={path(mod.path)}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {moduleMap && modules.some((mod) => mod.roles.includes(role) && moduleMap[mod.feature] !== true) && (
        <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Plan limited</Badge>
          Some support modules are hidden because they are not on your current plan.{' '}
          <Link href={path('/dashboard/settings/subscription')} className="underline underline-offset-2">
            Upgrade
          </Link>
        </p>
      )}
    </div>
  );
}

