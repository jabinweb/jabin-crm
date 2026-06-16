'use client';

import { cn } from "@/lib/utils";
import { Building2, Users, ShieldCheck, LogOut } from "lucide-react";
import { usePathname, useRouter, useParams } from "next/navigation";
import { signOut } from 'next-auth/react';

interface AdminNavProps {
  user: any;
}

export function AdminNav({ user }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ company: string }>();
  const slug = params?.company;

  const routes = [
    {
      label: 'Workspace Overview',
      icon: Building2,
      href: `/${slug}/admin`,
    },
    {
      label: 'Users',
      icon: Users,
      href: `/${slug}/admin/users`,
    },
    {
      label: 'Approvals',
      icon: ShieldCheck,
      href: `/${slug}/admin/approvals`,
    },
  ];

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-r w-64 flex-shrink-0">
      {/* Header */}
      <div className="px-6 py-8 border-b border-foreground/5">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-50">Workspace Admin</p>
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground mt-2">
          {slug?.toUpperCase()}
        </h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {routes.map((route) => {
          const isActive = pathname === route.href || pathname.startsWith(`${route.href}/`);
          return (
            <button
              key={route.href}
              onClick={() => router.push(route.href)}
              className={cn(
                "w-full flex items-center px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] transition-all border-l-2",
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
              )}
            >
              <route.icon className="h-3.5 w-3.5 mr-3 flex-shrink-0" />
              {route.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-foreground/5">
        {user?.email && (
          <p className="text-[9px] font-mono text-muted-foreground opacity-40 truncate px-3 mb-2">
            {user.email}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        >
          <LogOut className="h-3.5 w-3.5 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
