'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Loader2, Menu, Bell, Search, Settings, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PortalSidebar } from '@/components/layout/portal-sidebar';
import { Input } from '@/components/ui/input';
import { signOut } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

// ─── Notification Panel (real data) ──────────────────────────────────────────
function NotificationPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
    const queryClient = useQueryClient();

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['portal-notifications'],
        queryFn: async () => {
            const res = await fetch('/api/portal/notifications');
            if (!res.ok) throw new Error('Failed to fetch notifications');
            return res.json();
        },
        refetchInterval: 30_000, // Poll every 30 s
    });

    const markAllMutation = useMutation({
        mutationFn: async () => {
            await fetch('/api/portal/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true }),
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-notifications'] }),
    });

    const markOneMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch('/api/portal/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-notifications'] }),
    });

    return (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-slate-900/60 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
                <button
                    onClick={() => markAllMutation.mutate()}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors disabled:opacity-50"
                    disabled={markAllMutation.isPending}
                >
                    Mark all read
                </button>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                ) : notifications.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-8">No notifications yet</p>
                ) : (
                    notifications.map((n: any) => (
                        <div
                            key={n.id}
                            onClick={() => !n.read && markOneMutation.mutate(n.id)}
                            className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${!n.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                        >
                            <div className={`mt-1 flex-shrink-0 h-2 w-2 rounded-full ${!n.read ? 'bg-blue-600' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {new Date(n.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                <button className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium text-center transition-colors" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}

// ─── User Menu ────────────────────────────────────────────────────────────────
function UserMenu() {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const initials = session?.user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {initials}
                </div>
                <span className="hidden md:block text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[100px] truncate">
                    {session?.user?.name ?? 'User'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {open && (
                <div className="absolute right-0 top-12 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-slate-900/60 z-50 overflow-hidden py-1.5">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{session?.user?.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{session?.user?.email}</p>
                    </div>
                    <Link href="/portal/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <Settings className="h-4 w-4 text-slate-400" /> Settings
                    </Link>
                    <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <LayoutDashboard className="h-4 w-4 text-slate-400" /> Admin Dashboard
                    </Link>
                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                        <button
                            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    // Real unread count
    const { data: notifications = [] } = useQuery({
        queryKey: ['portal-notifications'],
        queryFn: async () => {
            const res = await fetch('/api/portal/notifications');
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!session?.user?.id,
        refetchInterval: 30_000,
    });
    const unreadCount = notifications.filter((n: any) => !n.read).length;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session) { router.push('/auth/signin'); return; }
        if (session.user.role !== 'CUSTOMER' && session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
            router.push('/dashboard');
        }
    }, [session, status, router]);

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!session || (session.user.role !== 'CUSTOMER' && session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shadow-sm z-30">
                <PortalSidebar />
            </aside>

            {/* Main Wrapper */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Top Navbar */}
                <header className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64">
                                <PortalSidebar onNavigate={() => setSidebarOpen(false)} />
                            </SheetContent>
                        </Sheet>

                        <div className="hidden md:flex items-center relative">
                            <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                            <Input
                                placeholder="Search tickets, equipment..."
                                className="pl-9 h-9 w-64 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus-visible:ring-blue-500 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Notification Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setNotifOpen(v => !v)}
                                className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Notifications"
                            >
                                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                                )}
                            </button>
                            {notifOpen && session.user.id && (
                                <NotificationPanel userId={session.user.id} onClose={() => setNotifOpen(false)} />
                            )}
                        </div>
                        <UserMenu />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            <Toaster />
        </div>
    );
}
