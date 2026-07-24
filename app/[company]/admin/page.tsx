'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DashboardPage } from '@/components/layout/dashboard-page';
import { Users, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const adminCards = [
  {
    label: 'Workspace users',
    description: 'People with access to this company',
    icon: Users,
    path: '/admin/users',
  },
  {
    label: 'Approvals',
    description: 'Review pending employee registrations',
    icon: ShieldCheck,
    path: '/admin/approvals',
  },
];

export default function AdminDashboard() {
  const params = useParams<{ company: string }>();
  const slug = params?.company;

  return (
    <DashboardPage>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage users and approvals for this company.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminCards.map((card) => (
          <Link key={card.path} href={`/${slug}${card.path}`} className="block">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="rounded-md border bg-background p-2">
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{card.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </DashboardPage>
  );
}
