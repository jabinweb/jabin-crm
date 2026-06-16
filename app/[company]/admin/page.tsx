'use client';

import { useCompany } from '@/contexts/company-context';
import { Card, CardContent } from '@/components/ui/card';
import { Users, ShieldCheck, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const adminCards = [
  {
    label: 'Users',
    description: 'Manage workspace users',
    icon: Users,
    path: '/admin/users',
  },
  {
    label: 'Approvals',
    description: 'Review pending requests',
    icon: ShieldCheck,
    path: '/admin/approvals',
  },
];

export default function AdminDashboard() {
  const params = useParams<{ company: string }>();
  const slug = params?.company;

  return (
    <div className="space-y-10">
      <div className="border-b border-foreground/5 pb-8">
        <h1 className="text-xl font-black tracking-[0.25em] uppercase text-foreground">
          Workspace Admin
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-3 tracking-[0.2em] opacity-40">
          {slug?.toUpperCase()} &bull; Management Console
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {adminCards.map((card) => (
          <Link key={card.path} href={`/${slug}${card.path}`}>
            <Card className="shadow-none border-2 border-foreground/5 bg-background rounded-none hover:border-foreground/20 transition-all group cursor-pointer">
              <CardContent className="p-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 border border-foreground/10 group-hover:bg-foreground group-hover:text-background transition-colors">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em]">
                      {card.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {card.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
