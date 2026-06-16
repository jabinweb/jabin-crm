'use client';

import Link from 'next/link';
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
  Loader2,
  Lock,
} from 'lucide-react';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';

const modules: Array<{
  title: string;
  description: string;
  href: string;
  icon: typeof Ticket;
  feature: FeatureModuleKey;
}> = [
  {
    title: 'Omnichannel inbox',
    description: 'Unified queue for email, chat, portal, phone, and WhatsApp tickets.',
    href: '/dashboard/support/inbox',
    icon: Inbox,
    feature: 'SUPPORT_INBOX',
  },
  {
    title: 'SLA policies',
    description: 'Configure first-response and resolution targets per priority level.',
    href: '/dashboard/support/sla-policies',
    icon: Clock,
    feature: 'SUPPORT_SLA',
  },
  {
    title: 'Ticket queue',
    description: 'Classic ticket list with filters and assignment.',
    href: '/dashboard/tickets',
    icon: LifeBuoy,
    feature: 'TICKETS',
  },
  {
    title: 'Knowledge base',
    description: 'Publish help articles for customers across any industry or product line.',
    href: '/dashboard/support/knowledge',
    icon: BookOpen,
    feature: 'SUPPORT_KNOWLEDGE',
  },
  {
    title: 'Canned responses',
    description: 'Agent reply templates for faster, consistent support (Freshdesk-style).',
    href: '/dashboard/support/canned-responses',
    icon: MessageSquare,
    feature: 'SUPPORT_CANNED',
  },
  {
    title: 'Agent groups',
    description: 'Route tickets to billing, technical, or regional support teams.',
    href: '/dashboard/support/groups',
    icon: Users,
    feature: 'SUPPORT_GROUPS',
  },
  {
    title: 'Customer accounts',
    description: 'Manage organizations, industries, and portal users — any vertical.',
    href: '/dashboard/customers',
    icon: LifeBuoy,
    feature: 'TICKETS',
  },
  {
    title: 'Support analytics',
    description: 'Volume, SLA, and account insights across your customer base.',
    href: '/dashboard/customers/analytics',
    icon: BarChart3,
    feature: 'TICKETS',
  },
];

export default function SupportDeskHubPage() {
  const [moduleMap, setModuleMap] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    fetch('/api/features/me')
      .then((res) => (res.ok ? res.json() : { modules: {} }))
      .then((data) => setModuleMap(data.modules ?? {}))
      .catch(() => setModuleMap({}));
  }, []);

  const visible = modules.filter((mod) => moduleMap?.[mod.feature] === true);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support desk</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Full customer support for every category — SaaS, retail, healthcare, manufacturing, and more.
          Built with Freshdesk-style ticketing, knowledge base, agent tools, and CSAT.
        </p>
      </div>

      {moduleMap === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
              <Link href="/dashboard/settings/subscription">View plans</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((mod) => (
            <Card key={mod.href} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <mod.icon className="h-5 w-5 text-primary" />
                  {mod.title}
                </CardTitle>
                <CardDescription>{mod.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href={mod.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {moduleMap && modules.some((mod) => moduleMap[mod.feature] !== true) && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Badge variant="secondary">Plan limited</Badge>
          Some support modules are hidden because they are not on your current plan.{' '}
          <Link href="/dashboard/settings/subscription" className="underline underline-offset-2">
            Upgrade
          </Link>
        </p>
      )}
    </div>
  );
}
