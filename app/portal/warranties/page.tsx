'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    AlertTriangle,
    CalendarDays,
    Wrench,
    PackageSearch,
} from 'lucide-react';
import Link from 'next/link';

function getWarrantyStatus(expiryDate: string | null) {
    if (!expiryDate) return { label: 'No Warranty', color: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-800/50', borderColor: 'border-slate-200 dark:border-slate-700', Icon: ShieldX };
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'Expired', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800', Icon: ShieldX };
    if (days <= 30) return { label: `Expiring in ${days}d`, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20', borderColor: 'border-orange-200 dark:border-orange-800', Icon: AlertTriangle };
    return { label: 'Active', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800', Icon: ShieldCheck };
}

function WarrantyCard({ installation }: { installation: any }) {
    const ws = getWarrantyStatus(installation.warrantyExpiry);
    const StatusIcon = ws.Icon;

    return (
        <Card className={`border ${ws.borderColor} bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all group`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                            <Wrench className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                                {installation.product?.name ?? 'Unknown Equipment'}
                            </CardTitle>
                            <p className="text-xs text-slate-400 mt-0.5">{installation.product?.manufacturer ?? ''} · {installation.product?.modelNumber ?? ''}</p>
                        </div>
                    </div>
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${ws.bgColor} ${ws.color} border ${ws.borderColor} flex-shrink-0`}>
                        <StatusIcon className="h-3 w-3" />
                        {ws.label}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
                {installation.serialNumber && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-400 uppercase tracking-wide text-[10px]">Serial:</span>
                        <span className="font-mono">{installation.serialNumber}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Installed: {new Date(installation.installationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
                {installation.warrantyExpiry && (
                    <div className={`flex items-center gap-2 text-xs font-medium ${ws.color}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span>Warranty: {new Date(installation.warrantyExpiry).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function WarrantiesPage() {
    const { data: equipment = [], isLoading } = useQuery({
        queryKey: ['portal-warranties'],
        queryFn: async () => {
            const res = await fetch('/api/portal/equipment');
            if (!res.ok) throw new Error('Failed to fetch equipment');
            return res.json();
        },
    });

    const expired = equipment.filter((e: any) => e.warrantyExpiry && new Date(e.warrantyExpiry) < new Date());
    const expiringSoon = equipment.filter((e: any) => {
        if (!e.warrantyExpiry) return false;
        const days = Math.ceil((new Date(e.warrantyExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 30;
    });
    const active = equipment.filter((e: any) => {
        if (!e.warrantyExpiry) return false;
        const days = Math.ceil((new Date(e.warrantyExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 30;
    });
    const noWarranty = equipment.filter((e: any) => !e.warrantyExpiry);

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Link href="/portal"><ChevronLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Warranty Overview</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Track warranty status and expiry dates for all installed equipment.</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {!isLoading && equipment.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Active', count: active.length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', Icon: ShieldCheck },
                        { label: 'Expiring Soon', count: expiringSoon.length, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', Icon: AlertTriangle },
                        { label: 'Expired', count: expired.length, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', Icon: ShieldX },
                        { label: 'No Warranty', count: noWarranty.length, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800', Icon: ShieldAlert },
                    ].map(({ label, count, color, bg, Icon }) => (
                        <Card key={label} className="border-none shadow-sm bg-white dark:bg-slate-900">
                            <CardContent className="pt-5 pb-4 flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`h-5 w-5 ${color}`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
                                    <p className="text-xs text-slate-500">{label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Equipment Grid */}
            {isLoading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            ) : equipment.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-24 text-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <PackageSearch className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">No equipment registered</p>
                        <p className="text-sm text-slate-400">Warranty information will appear here once equipment is installed at your facility.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {equipment.map((inst: any) => (
                        <WarrantyCard key={inst.id} installation={inst} />
                    ))}
                </div>
            )}
        </div>
    );
}
