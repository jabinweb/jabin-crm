import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Mail,
  Settings,
  Activity,
  FileText,
  ChevronLeft,
  Building2,
} from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'admin';

  if (!session?.user || !isSuperAdmin) {
    redirect(
      resolvePostLoginPath({
        role: session?.user?.role,
        companySlug: (session?.user as { companySlug?: string })?.companySlug,
      })
    );
  }

  const exitHref = resolvePostLoginPath({
    role: session.user.role,
    companySlug: (session.user as { companySlug?: string }).companySlug,
  });

  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/companies', label: 'Companies', icon: Building2 },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { href: '/admin/plans', label: 'Plans', icon: FileText },
    { href: '/admin/emails', label: 'Email Logs', icon: Mail },
    { href: '/admin/activity', label: 'Activity', icon: Activity },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'CRM';

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r bg-background flex flex-col">
        {/* Header */}
        <div className="px-6 py-8 border-b border-foreground/5">
          <div className="flex items-center space-x-2 mb-5">
            <div className="w-2 h-2 bg-foreground" />
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-foreground">
              {appName}
            </p>
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">
            Platform Admin
          </h2>
          <p className="text-[9px] font-mono text-muted-foreground opacity-30 mt-1 truncate">
            {session.user.email}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent hover:border-foreground/20 transition-all"
            >
              <item.icon className="w-3.5 h-3.5 mr-3 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-foreground/5">
          <Link
            href={exitHref}
            className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-2" />
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
