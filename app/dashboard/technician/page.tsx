'use client';

import { useQuery } from '@tanstack/react-query';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ClipboardList,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    TrendingUp,
    Activity,
    User,
    Wrench
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TechnicianDashboard() {
    const router = useRouter();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['technician-stats'],
        queryFn: async () => {
            const response = await fetch('/api/dashboard/technician-stats');
            if (!response.ok) throw new Error('Failed to fetch stats');
            return response.json();
        }
    });

    if (statsLoading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Technician Workspace</h2>
                    <p className="text-muted-foreground">Manage your assigned service tickets and reports.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/tickets">
                            View Full Queue
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/dashboard/service/gps">
                            GPS Check-In
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/dashboard/service/expenses">
                            Submit Expense
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-blue-50/50 dark:bg-blue-950/10 border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Assigned Tickets</CardTitle>
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.counts?.assigned || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Pending your attention</p>
                    </CardContent>
                </Card>

                <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                        <Clock className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.counts?.inProgress || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active site visits</p>
                    </CardContent>
                </Card>

                <Card className="bg-green-50/50 dark:bg-green-950/10 border-green-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Resolved</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.counts?.resolved || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Completion rate: 92%</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Worklist */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>My Active Worklist</CardTitle>
                        <CardDescription>Highest priority tickets assigned specifically to you.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.activeTickets?.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                    <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                                    <p className="font-medium">All caught up!</p>
                                    <p className="text-sm text-muted-foreground">No pending tickets in your assigned slot.</p>
                                </div>
                            ) : (
                                stats?.activeTickets?.map((ticket: any) => (
                                    <div key={ticket.id} className="group border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold">{ticket.subject}</p>
                                                    <Badge variant={ticket.priority === 'CRITICAL' ? 'destructive' : 'default'} className="text-[10px]">
                                                        {ticket.priority}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{ticket.customer.hospitalName}</p>
                                            </div>
                                            <Badge variant="outline">{ticket.status}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between mt-4">
                                            <div className="flex items-center space-x-4 text-[10px] text-muted-foreground">
                                                <div className="flex items-center">
                                                    <Clock className="mr-1 h-3 w-3" />
                                                    Opened {new Date(ticket.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center">
                                                    <TrendingUp className="mr-1 h-3 w-3" />
                                                    SLA: 4h
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                Open Details
                                                <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Service Success */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Reports</CardTitle>
                        <CardDescription>Your recently completed visits.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.recentReports?.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic text-center py-4">No reports filed recently.</p>
                            ) : (
                                stats?.recentReports?.map((report: any) => (
                                    <div key={report.id} className="p-3 border-l-4 border-l-green-500 bg-muted/20 rounded-r-lg space-y-1">
                                        <p className="text-xs font-bold truncate">{report.ticket.subject}</p>
                                        <p className="text-[10px] text-muted-foreground">Facility: {report.ticket.customer.hospitalName}</p>
                                        <p className="text-[10px] italic">" {report.serviceNotes.slice(0, 60)}... "</p>
                                        <p className="text-[9px] text-muted-foreground mt-2">{new Date(report.createdAt).toLocaleDateString()}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <Button variant="ghost" className="w-full mt-4 text-xs h-8" asChild>
                            <Link href="/dashboard/tickets?status=RESOLVED">
                                View Resolution History
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
