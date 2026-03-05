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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Wrench,
    ChevronLeft,
    ShieldCheck,
    Calendar,
    Search,
    Download
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CustomerEquipmentInventory() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: inventory, isLoading } = useQuery({
        queryKey: ['portal-equipment'],
        queryFn: async () => {
            const response = await fetch('/api/portal/equipment');
            if (!response.ok) throw new Error('Failed to fetch equipment');
            return response.json();
        }
    });

    const filteredInventory = inventory?.filter((item: any) =>
        item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/portal')} className="rounded-full">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold ">Medical Equipment Assets</h1>
                        <p className="text-sm text-slate-500">Full inventory of life-saving devices installed at your facility.</p>
                    </div>
                </div>
                <Button variant="outline" className="border-slate-200">
                    <Download className="mr-2 h-4 w-4" />
                    Export Inventory
                </Button>
            </div>

            <div className="flex items-center space-x-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by SN or Model name..."
                        className="pl-9 h-10 border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg">
                    {filteredInventory?.length || 0} Assets Registered
                </div>
            </div>

            <Card className="border-none bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-bold text-slate-500 py-4 pl-6">Product Model</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Serial Number</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Installation Date</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Warranty Status</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Category</TableHead>
                                <TableHead className="text-right font-bold text-slate-500 py-4 pr-6">Service</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInventory?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-24 text-slate-400 italic">
                                        No equipment assets found in your facility inventory.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInventory?.map((item: any) => {
                                    const isWarrantyActive = new Date(item.warrantyExpiry) > new Date();
                                    return (
                                        <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-50 dark:border-slate-800">
                                            <TableCell className="pl-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{item.product?.name}</span>
                                                    <span className="text-[10px] text-slate-500">ID: {item.id.slice(-8).toUpperCase()}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{item.serialNumber}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center text-xs text-slate-600">
                                                    <Calendar className="h-3.5 w-3.5 mr-2 opacity-50" />
                                                    {new Date(item.installationDate).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={`inline-flex flex-col items-start px-2 py-1 rounded-lg border ${isWarrantyActive ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'
                                                    }`}>
                                                    <span className={`text-[10px] font-bold tracking-wider uppercase ${isWarrantyActive ? 'text-green-700' : 'text-red-700'
                                                        }`}>
                                                        {isWarrantyActive ? 'Active Coverage' : 'Service Required'}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 mt-0.5">Expires {new Date(item.warrantyExpiry).toLocaleDateString()}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2">
                                                    {item.product?.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm text-xs h-8 px-4" asChild>
                                                    <Link href={`/portal/tickets/new?equipmentId=${item.id}`}>
                                                        Request Service
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
