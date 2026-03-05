'use client';

import { useQuery } from '@tanstack/react-query';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Wrench,
    Ticket,
    ShieldCheck,
    Activity,
    PlusCircle,
    ArrowUpRight,
    User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HospitalPortalPage() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['portal-stats'],
        queryFn: async () => {
            const response = await fetch('/api/portal/stats');
            if (!response.ok) throw new Error('Failed to fetch portal stats');
            return response.json();
        }
    });

    if (isLoading) {
        return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-slate-900 dark:text-white">Facility Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your hospital's medical equipment and support requests.</p>
                </div>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
                    <Link href="/portal/tickets/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Support Request
                    </Link>
                </Button>
            </div>

            {/* Metrics Row */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500">Installed Units</CardTitle>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                            <Wrench className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats?.totalEquipment || 0}</div>
                        <p className="text-xs text-slate-400 mt-1">Registered medical devices</p>
                    </CardContent>
                </Card>
                <Card className="border-none bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500">Active Requests</CardTitle>
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                            <Ticket className="h-4 w-4 text-orange-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats?.openTickets || 0}</div>
                        <p className="text-xs text-slate-400 mt-1">Support tickets in progress</p>
                    </CardContent>
                </Card>
                <Card className="border-none bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500">Warranty Alerts</CardTitle>
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg">
                            <ShieldCheck className="h-4 w-4 text-yellow-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats?.pendingWarranties || 0}</div>
                        <p className="text-xs text-slate-400 mt-1">Expiring within 30 days</p>
                    </CardContent>
                </Card>
                <Card className="border-none bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500">System Uptime</CardTitle>
                        <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                            <Activity className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">99.2%</div>
                        <p className="text-xs text-slate-400 mt-1">Critical equipment health</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Recent Tickets Section */}
                <Card className="lg:col-span-4 border-none bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
                        <div>
                            <CardTitle>Recent Support Requests</CardTitle>
                            <CardDescription>The status of your latest help requests.</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <Link href="/portal/tickets">
                                View Queue <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            {stats?.recentTickets?.length === 0 ? (
                                <p className="text-sm text-center py-10 text-slate-400">No recent support requests found.</p>
                            ) : (
                                stats?.recentTickets?.map((ticket: any) => (
                                    <div key={ticket.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold group-hover:text-blue-600 transition-colors">{ticket.subject}</p>
                                            <p className="text-xs text-slate-400">
                                                Created {new Date(ticket.createdAt).toLocaleDateString()} • {ticket.priority}
                                            </p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                                                ticket.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {ticket.status}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions / Facility Info */}
                <Card className="lg:col-span-3 border-none bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4 text-center">
                        <CardTitle>Facility Overview</CardTitle>
                        <CardDescription>Key information about your installation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6 text-center">
                        <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Your Support Manager</p>
                            <div className="flex flex-col items-center space-y-3 p-6 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30">
                                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-xl shadow-blue-500/20">JS</div>
                                <div>
                                    <p className="text-base font-bold text-slate-900 dark:text-white">Jabin Support Team</p>
                                    <p className="text-sm text-slate-500">24/7 Priority Support Line</p>
                                </div>
                                <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 border border-blue-100 shadow-sm" variant="outline">Contact Specialist</Button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Resources</p>
                            <div className="grid grid-cols-1 gap-2">
                                <Button variant="outline" className="w-full justify-start h-12 border-slate-100 hover:bg-slate-50 hover:text-blue-600 transition-all px-4" asChild>
                                    <Link href="/portal/equipment">
                                        <Wrench className="mr-3 h-4 w-4 text-slate-400" />
                                        Equipment Inventory
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-12 border-slate-100 hover:bg-slate-50 hover:text-blue-600 transition-all px-4" asChild>
                                    <Link href="/portal/maintenance">
                                        <Activity className="mr-3 h-4 w-4 text-slate-400" />
                                        Compliance Reports
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
