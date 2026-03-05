'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft,
    Wrench,
    CheckCircle2,
    Clock,
    AlertTriangle,
    FileText,
    User,
    CalendarDays,
} from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-100',
    OPEN: 'bg-orange-50 text-orange-700 border-orange-100',
    CLOSED: 'bg-slate-50 text-slate-600 border-slate-100',
};

const statusIcons: Record<string, any> = {
    RESOLVED: CheckCircle2,
    IN_PROGRESS: Clock,
    OPEN: AlertTriangle,
    CLOSED: FileText,
};

function ServiceEventCard({ report }: { report: any }) {
    const StatusIcon = statusIcons[report.ticket?.status] ?? FileText;
    return (
        <div className="relative flex gap-6">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 rounded-full bg-blue-600/10 border border-blue-200 dark:border-blue-800 items-center justify-center flex-shrink-0 shadow-sm">
                    <Wrench className="h-4 w-4 text-blue-600" />
                </div>
                <div className="w-px flex-1 bg-slate-200 dark:bg-slate-800 mt-2" />
            </div>

            <Card className="flex-1 mb-6 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                                {report.ticket?.subject ?? 'Service Event'}
                            </CardTitle>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Ref: #{report.ticketId?.slice(-6).toUpperCase()}
                            </p>
                        </div>
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors[report.ticket?.status] ?? statusColors['CLOSED']}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {report.ticket?.status ?? 'CLOSED'}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{report.serviceNotes}</p>
                    {report.partsReplaced && (
                        <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                            <Wrench className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Parts Replaced</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{report.partsReplaced}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {report.technician?.name ?? 'Unassigned'}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        {report.nextMaintenanceDate && (
                            <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                                <Clock className="h-3.5 w-3.5" />
                                Next service: {new Date(report.nextMaintenanceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ServiceHistoryPage() {
    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['portal-service-history'],
        queryFn: async () => {
            const res = await fetch('/api/portal/service-history');
            if (!res.ok) throw new Error('Failed to fetch service history');
            return res.json();
        },
    });

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Link href="/portal"><ChevronLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Service History</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">A chronological log of all maintenance performed on your equipment.</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            ) : reports.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-24 text-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">No service records yet</p>
                        <p className="text-sm text-slate-400">Service reports will appear here once a technician completes a job for your facility.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="pt-2">
                    {reports.map((report: any) => (
                        <ServiceEventCard key={report.id} report={report} />
                    ))}
                    {/* Timeline end marker */}
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                        <div className="h-3 w-3 rounded-full bg-slate-200 dark:bg-slate-700 ml-3.5" />
                        <span>End of service history</span>
                    </div>
                </div>
            )}
        </div>
    );
}
