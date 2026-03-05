'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Ticket,
    Plus,
    Search,
    Filter,
    User,
    Clock,
    AlertCircle,
    ChevronRight,
    UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function TicketsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<string>('all');
    const [priority, setPriority] = useState<string>('all');

    const { data: tickets, isLoading } = useQuery({
        queryKey: ['tickets', { status, priority }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (status !== 'all') params.append('status', status);
            if (priority !== 'all') params.append('priority', priority);

            const response = await fetch(`/api/tickets?${params}`);
            if (!response.ok) throw new Error('Failed to fetch tickets');
            return response.json();
        }
    });

    const filteredTickets = tickets?.filter((t: any) =>
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.customer.hospitalName.toLowerCase().includes(search.toLowerCase())
    );

    const getPriorityVariant = (p: string) => {
        switch (p) {
            case 'CRITICAL': return 'destructive';
            case 'HIGH': return 'default';
            case 'MEDIUM': return 'secondary';
            default: return 'outline';
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'OPEN': return 'text-red-500';
            case 'IN_PROGRESS': return 'text-blue-500';
            case 'RESOLVED': return 'text-green-500';
            case 'CLOSED': return 'text-gray-500';
            default: return 'text-orange-500';
        }
    };

    return (
        <div className="flex-1 space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Support Management</h2>
                <Button asChild>
                    <Link href="/dashboard/tickets/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Ticket
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Ticket Queue</CardTitle>
                            <CardDescription>
                                Monitor and manage incoming support requests.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ticket title or hospital..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="OPEN">Open</SelectItem>
                                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="w-full sm:w-[150px]">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priority</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="LOW">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">ID</TableHead>
                                        <TableHead>Subject / Facility</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTickets?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                                No support tickets found matching your filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredTickets?.map((ticket: any) => (
                                            <TableRow key={ticket.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {ticket.id.slice(-6).toUpperCase()}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <p className="font-medium text-sm">{ticket.subject}</p>
                                                        <p className="text-xs text-muted-foreground">{ticket.customer.hospitalName}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getPriorityVariant(ticket.priority)} className="text-[10px] px-1.5 py-0">
                                                        {ticket.priority}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2 text-xs">
                                                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span>{ticket.assignedTechnician?.name || 'Unassigned'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2 text-xs font-medium">
                                                        <div className={`w-2 h-2 rounded-full ${getStatusColor(ticket.status).replace('text-', 'bg-')}`} />
                                                        <span className={getStatusColor(ticket.status)}>{ticket.status}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {new Date(ticket.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
