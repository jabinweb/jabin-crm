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
import { getClientBrandConfig } from '@/lib/branding';
import { usePathname } from 'next/navigation';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import type { WorkspaceFeatureKey } from '@/lib/workspace-templates';

interface NavigationItem {
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    workspaceFeature?: WorkspaceFeatureKey;
}

const portalNav: NavigationItem[] = [
    { name: 'Dashboard', href: '/portal', icon: LayoutDashboard },
    { name: 'Assets', href: '/portal/equipment', icon: Wrench, workspaceFeature: 'equipment' },
    { name: 'Tickets', href: '/portal/tickets', icon: Ticket, workspaceFeature: 'customerPortal' },
    { name: 'Service history', href: '/portal/service-history', icon: History, workspaceFeature: 'serviceHistory' },
];

const secondaryNav: NavigationItem[] = [
    { name: 'Warranties', href: '/portal/warranties', icon: ShieldCheck, workspaceFeature: 'warranties' },
    { name: 'Help & support', href: '/portal/support', icon: LifeBuoy },
    { name: 'Settings', href: '/portal/settings', icon: Settings },
];

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void }) {
    const { data: session } = useSession();
    const customerName = session?.user?.name || 'Customer user';
    const pathname = usePathname();
    const { data: workspaceData } = useWorkspaceConfig();
    const features = workspaceData?.config.features;
    const terminology = workspaceData?.config.terminology;

    const isActive = (href: string) => {
        if (href === '/portal') return pathname === '/portal';
        return pathname.startsWith(href);
    };

    const filterItems = (items: NavigationItem[]) =>
        items.filter((item) => {
            if (!item.workspaceFeature || !features) return true;
            return features[item.workspaceFeature] === true;
        });

    const labelFor = (item: NavigationItem) => {
        if (item.href === '/portal/equipment' && terminology?.equipment) {
            return terminology.equipment;
        }
        if (item.href === '/portal/tickets' && terminology?.ticket) {
            return `${terminology.ticket} tracker`;
        }
        return item.name;
    };

    const renderNavGroup = (items: NavigationItem[], title?: string) => {
        const visible = filterItems(items);
        if (visible.length === 0) return null;

        return (
            <div className="py-2">
                {title && <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-widest text-slate-400/70">{title}</h3>}
                <div className="space-y-1">
                    {visible.map((item) => (
                        <Button
                            key={item.href}
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
                                <span className="text-sm">{labelFor(item)}</span>
                            </Link>
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const brand = getClientBrandConfig();
    const newRequestLabel = terminology?.newRequest ?? 'New request';

    return (
        <div className="pb-12 w-64 border-r h-full bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl flex flex-col">
            <div className="p-6">
                <Link href="/portal" className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-none flex items-center justify-center text-white font-bold shadow-none shadow-blue-500/20">
                      {brand.appName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-400">{brand.appName}</span>
                </Link>
            </div>

            <div className="flex-1 px-3 space-y-6 pt-2">
                <div>
                    <Button asChild className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white shadow-none shadow-blue-500/20">
                        <Link href="/portal/tickets/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {newRequestLabel}
                        </Link>
                    </Button>
                    {renderNavGroup(portalNav, "Overview")}
                </div>
                {renderNavGroup(secondaryNav, "System")}
            </div>

            <div className="p-4 mt-auto border-t bg-slate-100/30 dark:bg-slate-900/10">
                <div className="flex items-center space-x-3 p-2 rounded-none hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <div className="h-8 w-8 rounded-none bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">{customerName.charAt(0)}</div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-semibold truncate">{customerName}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {terminology?.customer ?? 'Customer'} portal
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
