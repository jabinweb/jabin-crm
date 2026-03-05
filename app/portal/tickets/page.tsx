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
    Ticket,
    ChevronLeft,
    ExternalLink,
    Clock,
    User,
    Search,
    Filter
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export default function CustomerTicketQueue() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: tickets, isLoading } = useQuery({
        queryKey: ['portal-tickets'],
        queryFn: async () => {
            const response = await fetch('/api/portal/tickets');
            if (!response.ok) throw new Error('Failed to fetch tickets');
            return response.json();
        }
    });

    const filteredTickets = tickets?.filter((t: any) =>
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/portal')} className="rounded-full hover:bg-slate-100">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold ">Support Request Queue</h1>
                        <p className="text-sm text-slate-500">Monitor the live status of your facility's help requests.</p>
                    </div>
                </div>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    <Link href="/portal/tickets/new">
                        <Ticket className="mr-2 h-4 w-4" />
                        Submit New Request
                    </Link>
                </Button>
            </div>

            <div className="flex items-center space-x-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by ID or Subject..."
                        className="pl-9 h-10 border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                    <Filter className="h-4 w-4 text-slate-500" />
                </Button>
            </div>

            <Card className="border-none bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-[100px] font-bold text-slate-500 py-4 pl-6">ID</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Subject</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Status</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Priority</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Assigned Tech</TableHead>
                                <TableHead className="font-bold text-slate-500 py-4">Created</TableHead>
                                <TableHead className="text-right font-bold text-slate-500 py-4 pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTickets?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-24 text-slate-400 italic">
                                        No support tickets in your history matching your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTickets?.map((ticket: any) => (
                                    <TableRow key={ticket.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-50 dark:border-slate-800">
                                        <TableCell className="font-mono text-[10px] text-slate-500 pl-6">#{ticket.id.slice(-6).toUpperCase()}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">{ticket.subject}</span>
                                                <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{ticket.description}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${ticket.status === 'RESOLVED' ? 'bg-green-50 text-green-700 border-green-100' :
                                                ticket.status === 'OPEN' ? 'bg-red-50 text-red-700 border-red-100' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                {ticket.status}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-1.5">
                                                <span className={`h-2 w-2 rounded-full ${ticket.priority === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                                                    ticket.priority === 'HIGH' ? 'bg-orange-500' : 'bg-blue-500'
                                                    }`} />
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{ticket.priority}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mr-2 text-[10px] font-bold">
                                                    {ticket.assignedTechnician?.name?.charAt(0) || '?'}
                                                </div>
                                                {ticket.assignedTechnician?.name || 'In Triage'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-xs text-slate-500">
                                                <Clock className="h-3.5 w-3.5 mr-1.5 opacity-60" />
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                                                <Link href={`/portal/tickets/${ticket.id}`}>
                                                    Manage <ExternalLink className="ml-2 h-3 w-3" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
