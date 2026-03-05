'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import {
    LayoutDashboard,
    Wrench,
    Ticket,
    Settings,
    ShieldCheck,
    History,
    LifeBuoy,
    PlusCircle
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavigationItem {
    name: string;
    href: string;
    icon: any;
}

const portalNav: NavigationItem[] = [
    { name: 'Dashboard', href: '/portal', icon: LayoutDashboard },
    { name: 'Equipment Inventory', href: '/portal/equipment', icon: Wrench },
    { name: 'Ticket Tracker', href: '/portal/tickets', icon: Ticket },
    { name: 'Service History', href: '/portal/service-history', icon: History },
];

const secondaryNav: NavigationItem[] = [
    { name: 'Warranty Info', href: '/portal/warranties', icon: ShieldCheck },
    { name: 'Help & Support', href: '/portal/support', icon: LifeBuoy },
    { name: 'Settings', href: '/portal/settings', icon: Settings },
];

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void }) {
    const { data: session } = useSession();
    const customerName = session?.user?.name || 'Hospital Staff';
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/portal') return pathname === '/portal';
        return pathname.startsWith(href);
    };

    const renderNavGroup = (items: NavigationItem[], title?: string) => {
        return (
            <div className="py-2">
                {title && <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-widest text-slate-400/70">{title}</h3>}
                <div className="space-y-1">
                    {items.map((item) => (
                        <Button
                            key={item.name}
                            variant={isActive(item.href) ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-start h-10 px-4 transition-all duration-200",
                                isActive(item.href)
                                    ? "bg-blue-600/10 text-blue-600 font-medium border-r-2 border-blue-600 rounded-r-none"
                                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            )}
                            asChild
                            onClick={onNavigate}
                        >
                            <Link href={item.href}>
                                <item.icon className={cn(
                                    "mr-3 h-4 w-4",
                                    isActive(item.href) ? "text-blue-600" : "text-slate-400"
                                )} />
                                <span className="text-sm">{item.name}</span>
                            </Link>
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="pb-12 w-64 border-r h-full bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl flex flex-col">
            <div className="p-6">
                <Link href="/portal" className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">J</div>
                    <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-400">Jabin <span className="font-light">Hospital</span></span>
                </Link>
            </div>

            <div className="flex-1 px-3 space-y-6 pt-2">
                <div>
                    <Button asChild className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                        <Link href="/portal/tickets/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            New Request
                        </Link>
                    </Button>
                    {renderNavGroup(portalNav, "Overview")}
                </div>
                {renderNavGroup(secondaryNav, "System")}
            </div>

            <div className="p-4 mt-auto border-t bg-slate-100/30 dark:bg-slate-900/10">
                <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">{customerName.charAt(0)}</div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-semibold truncate">{customerName}</p>
                        <p className="text-[10px] text-slate-500 truncate">Hospital Partner</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
