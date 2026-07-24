'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Wrench,
    ShieldCheck,
    PlusCircle,
    ArrowUpRight,
    LifeBuoy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import { PageHeaderSkeleton, StatCardsSkeleton, CardListSkeleton } from '@/components/loading';

export default function CustomerPortalPage() {
    const { data: workspaceData } = useWorkspaceConfig();
    const features = workspaceData?.config.features;
    const terminology = workspaceData?.config.terminology;

    const { data: stats, isLoading } = useQuery({
        queryKey: ['portal-stats'],
        queryFn: async () => {
            const response = await fetch('/api/portal/stats');
            if (!response.ok) throw new Error('Failed to fetch portal stats');
            return response.json();
        }
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeaderSkeleton />
                <StatCardsSkeleton count={4} />
                <CardListSkeleton rows={3} />
            </div>
        );
    }

    const resolvedCount = stats?.resolvedTickets ?? 0;
    const totalTickets = (stats?.openTickets ?? 0) + resolvedCount;
    const resolutionRate = totalTickets > 0 ? Math.round((resolvedCount / totalTickets) * 100) : 100;

    const showEquipment = features?.equipment === true;
    const showWarranties = features?.warranties === true;
    const showServiceHistory = features?.serviceHistory === true;
    const ticketLabel = terminology?.ticket ?? 'Ticket';
    const equipmentLabel = terminology?.equipment ?? 'Equipment';
    const newRequestLabel = terminology?.newRequest ?? 'New support request';
    const subtitle =
        terminology?.portalSubtitle ??
        'Manage support, account activity, and self-service for your organization.';

    const quickLinks = [
        showEquipment
            ? { href: '/portal/equipment', label: `View ${equipmentLabel.toLowerCase()}` }
            : null,
        { href: '/portal/support', label: 'Help center' },
        showServiceHistory ? { href: '/portal/service-history', label: 'Service history' } : null,
        { href: '/portal/settings', label: 'Account settings' },
    ].filter(Boolean) as Array<{ href: string; label: string }>;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Customer portal</h1>
                    <p className="text-muted-foreground mt-1">{subtitle}</p>
                </div>
                <Button asChild>
                    <Link href="/portal/tickets/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {newRequestLabel}
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {showEquipment ? (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Installed {equipmentLabel.toLowerCase()}
                            </CardTitle>
                            <Wrench className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.totalEquipment || 0}</div>
                        </CardContent>
                    </Card>
                ) : null}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Open {ticketLabel.toLowerCase()}s
                        </CardTitle>
                        <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats?.openTickets || 0}</div>
                    </CardContent>
                </Card>
                {showWarranties ? (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Warranty alerts</CardTitle>
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats?.pendingWarranties || 0}</div>
                        </CardContent>
                    </Card>
                ) : null}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Resolution rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{resolutionRate}%</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Recent {ticketLabel.toLowerCase()}s</CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/portal/tickets">
                                View all <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats?.recentTickets?.length === 0 ? (
                                <p className="text-sm text-center py-10 text-muted-foreground">
                                    No recent {ticketLabel.toLowerCase()}s.
                                </p>
                            ) : (
                                stats?.recentTickets?.map((ticket: { id: string; subject: string; createdAt: string; priority: string; status: string }) => (
                                    <Link
                                        key={ticket.id}
                                        href={`/portal/tickets/${ticket.id}`}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">{ticket.subject}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(ticket.createdAt).toLocaleDateString()} · {ticket.priority}
                                            </p>
                                        </div>
                                        <span className="text-xs font-medium uppercase">{ticket.status}</span>
                                    </Link>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-base">Quick links</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {quickLinks.map((link) => (
                            <Button key={link.href} variant="outline" className="w-full justify-start" asChild>
                                <Link href={link.href}>{link.label}</Link>
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
