'use client';

import { useQuery } from '@tanstack/react-query';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Building,
    Activity,
    AlertTriangle,
    MapPin,
    ShieldCheck,
    TrendingUp,
    Wrench,
    Clock,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function CustomerAnalyticsPage() {
    const { data: analytics, isLoading } = useQuery({
        queryKey: ['customer-analytics'],
        queryFn: async () => {
            const response = await fetch('/api/dashboard/customer-stats');
            if (!response.ok) throw new Error('Failed to fetch analytics');
            return response.json();
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Customer Analytics Hub</h2>
                    <p className="text-muted-foreground">Strategic overview of hospital engagement and equipment health.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/customers">
                            <Building className="mr-2 h-4 w-4" />
                            Hospital Directory
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Top Level Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-l-4 border-l-blue-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Facilities</CardTitle>
                        <Building className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.summary?.totalCustomers || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Registered hospitals & clinics</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Field Assets</CardTitle>
                        <Activity className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.summary?.totalEquipment || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Installed medical units</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-600 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Service Pressure</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.summary?.activeTickets || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Current open support tickets</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Regional Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-red-500" />
                            Regional Concentration
                        </CardTitle>
                        <CardDescription>Top cities by facility count.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {analytics?.cityDistribution?.map((city: any, i: number) => (
                            <div key={city.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                        {i + 1}
                                    </div>
                                    <span className="text-sm font-medium">{city.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary"
                                            style={{ width: `${(city.count / analytics.summary.totalCustomers) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold w-4 text-right">{city.count}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* 2. Equipment Health Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-blue-500" />
                            Asset Integrity
                        </CardTitle>
                        <CardDescription>Current status of field installations.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {analytics?.equipmentStatus?.map((status: any) => (
                            <div key={status.status} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${status.status === 'ACTIVE' ? 'bg-green-500' :
                                            status.status === 'UNDER_MAINTENANCE' ? 'bg-orange-500' : 'bg-red-500'
                                        }`} />
                                    <span className="text-sm font-medium uppercase tracking-wider">{status.status.replace(/_/g, ' ')}</span>
                                </div>
                                <span className="text-lg font-bold">{status.count}</span>
                            </div>
                        ))}
                        {(!analytics?.equipmentStatus || analytics.equipmentStatus.length === 0) && (
                            <p className="text-sm text-muted-foreground italic py-4">No equipment data available.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 3. Ticket Density (High Demand Customers) */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            High Maintenance
                        </CardTitle>
                        <CardDescription>Facilities with highest service volume.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {analytics?.highDemandHospitals?.map((h: any) => (
                            <div key={h.name} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded transition-colors group">
                                <span className="text-sm truncate w-40">{h.name}</span>
                                <Badge variant="secondary" className="group-hover:bg-primary group-hover:text-white transition-colors">
                                    {h.ticketCount} Tickets
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* 4. Proactive Maintenance / Warranty Expiries */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
                            <Clock className="h-4 w-4 text-orange-500" />
                            Upcoming Expiries (30 Days)
                        </CardTitle>
                        <CardDescription>Identify units needing warranty extension or renewal.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {analytics?.upcomingExpiries?.length === 0 ? (
                                <div className="text-center py-8 bg-muted/20 rounded-lg border-2 border-dashed">
                                    <ShieldCheck className="h-8 w-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium">No urgent expiries</p>
                                    <p className="text-xs text-muted-foreground">All unit warranties are stable for the next month.</p>
                                </div>
                            ) : (
                                analytics?.upcomingExpiries?.map((eq: any) => (
                                    <div key={eq.id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50/20">
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold">{eq.product.name} (SN: {eq.serialNumber})</p>
                                            <p className="text-xs text-muted-foreground">{eq.customer.hospitalName}</p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="text-xs font-bold text-red-600 leading-none">
                                                {new Date(eq.warrantyExpiry).toLocaleDateString()}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">Expires soon</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 5. Recent Activity Feed */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-indigo-500" />
                        CRM Intelligence Stream
                    </CardTitle>
                    <CardDescription>Live feed of facility interactions and service events.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[1px] before:bg-muted">
                        {analytics?.recentActivity?.map((activity: any) => (
                            <div key={activity.id} className="relative pl-10 flex items-start gap-3">
                                <div className="absolute left-0 top-1 w-9 h-9 rounded-full bg-background border flex items-center justify-center z-10">
                                    <Activity className="h-4 w-4 text-primary" />
                                </div>
                                <div className="space-y-1 py-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold">{activity.customer.hospitalName}</p>
                                        <Badge variant="outline" className="text-[9px] h-4">{activity.eventType}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                                    <p className="text-[10px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

