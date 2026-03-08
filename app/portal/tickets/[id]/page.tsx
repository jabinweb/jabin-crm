'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    ChevronLeft,
    MessageSquare,
    History,
    Sparkles,
    User,
    Activity as ActivityIcon,
    Clock,
    Building,
    Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AITicketSummary } from '@/components/tickets/AITicketSummary';

export default function PortalTicketDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['portal-ticket', id],
        queryFn: async () => {
            const response = await fetch(`/api/tickets/${id}`);
            if (!response.ok) throw new Error('Failed to fetch ticket');
            return response.json();
        },
    });

    const { data: sla } = useQuery({
        queryKey: ['portal-ticket-sla', id],
        enabled: !!id,
        queryFn: async () => {
            const response = await fetch(`/api/tickets/${id}/sla`);
            if (!response.ok) throw new Error('Failed to fetch SLA');
            return response.json();
        },
    });

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        setIsSubmittingComment(true);
        try {
            const response = await fetch(`/api/tickets/${id}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: newComment }),
            });
            if (!response.ok) throw new Error('Failed to add comment');
            toast.success('Your message has been sent to our support team');
            setNewComment('');
            queryClient.invalidateQueries({ queryKey: ['portal-ticket', id] });
        } catch (error) {
            toast.error('Failed to send message');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    }

    if (!ticket) return <div className="text-center py-20"><h3 className="text-xl font-semibold">Support request not found</h3></div>;

    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    const slaStateLabel = sla?.state ? String(sla.state).replace(/_/g, ' ') : 'Monitoring';
    const slaTone =
        sla?.state === 'BREACHED' || sla?.state === 'RESOLVED_BREACHED'
            ? 'bg-red-500'
            : sla?.state === 'AT_RISK'
                ? 'bg-amber-500'
                : 'bg-green-500';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => router.push('/portal/tickets')} className="text-slate-500 hover:text-blue-600">
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Queue
                </Button>
                <div className="flex items-center space-x-2">
                    <Badge variant={ticket.status === 'RESOLVED' ? 'outline' : 'default'} className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase",
                        ticket.status === 'RESOLVED' ? "bg-green-100 text-green-700 border-green-200" : "bg-blue-600 text-white"
                    )}>
                        {ticket.status}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Content */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="h-2 bg-blue-600" />
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-slate-200">
                                    {ticket.priority} Priority
                                </Badge>
                                <span className="text-[10px] font-mono text-slate-400 tracking-tighter">REF: {ticket.id.toUpperCase()}</span>
                            </div>
                            <CardTitle className="text-2xl font-bold  leading-tight">
                                {ticket.subject}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {ticket.description}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <AITicketSummary ticketId={id as string} className="mt-6" />

                    <Tabs defaultValue="conversation" className="space-y-6">
                        <TabsList className="bg-slate-100/50 dark:bg-slate-900/50 p-1">
                            <TabsTrigger value="conversation" className="rounded-md px-6">Support Conversation</TabsTrigger>
                            <TabsTrigger value="history" className="rounded-md px-6">Service History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="conversation" className="space-y-4">
                            <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                                <CardContent className="pt-6 space-y-6">
                                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {ticket.activities?.filter((a: any) => a.eventType === 'COMMENT').length === 0 ? (
                                            <div className="text-center py-10 space-y-2">
                                                <MessageSquare className="h-8 w-8 text-slate-200 mx-auto" />
                                                <p className="text-sm text-slate-400">No messages yet. Our team will update you here.</p>
                                            </div>
                                        ) : (
                                            ticket.activities?.filter((a: any) => a.eventType === 'COMMENT').map((comment: any) => (
                                                <div key={comment.id} className={cn(
                                                    "p-4 rounded-2xl border max-w-[85%]",
                                                    comment.performedById ? "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 ml-0 mr-auto" : "bg-blue-600 text-white border-blue-500 ml-auto mr-0"
                                                )}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                                                            {comment.performedBy?.name || 'Your Facility'}
                                                        </p>
                                                        <p className="text-[9px] opacity-60 italic">{new Date(comment.createdAt).toLocaleString()}</p>
                                                    </div>
                                                    <p className="text-sm leading-relaxed">{comment.description}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {!isResolved && (
                                        <div className="space-y-3 mt-6 pt-6 border-t border-slate-50 dark:border-slate-800">
                                            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Send a Message</Label>
                                            <Textarea
                                                placeholder="Provide additional details or ask for an update..."
                                                className="min-h-[120px] rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all resize-none shadow-inner"
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                            />
                                            <div className="flex justify-end">
                                                <Button
                                                    onClick={handleAddComment}
                                                    disabled={isSubmittingComment || !newComment.trim()}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-8 rounded-xl"
                                                >
                                                    {isSubmittingComment ? 'Sending...' : 'Send Message'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history">
                            <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                                <CardContent className="pt-6 pb-8">
                                    <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                                        {ticket.activities?.map((activity: any) => (
                                            <div key={activity.id} className="relative pl-10 group">
                                                <div className="absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 group-hover:bg-blue-600 transition-colors z-10 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{activity.eventType.replace(/_/g, ' ')}</p>
                                                    <p className="text-xs text-slate-500 leading-relaxed">{activity.description}</p>
                                                    <div className="flex items-center text-[10px] text-slate-400 mt-1">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {new Date(activity.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right: Sidebar Meta */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                        <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Request Lifecycle</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Assigned Specialist</p>
                                <div className="flex items-center space-x-3 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/10">
                                        {ticket.assignedTechnician?.name?.charAt(0) || <User className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{ticket.assignedTechnician?.name || 'Triage in Progress'}</p>
                                        <p className="text-xs text-slate-500">{ticket.assignedTechnician?.email || 'Jabin Medical Support'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Verified Equipment</p>
                                <div className="p-4 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl bg-blue-50/30 dark:bg-blue-950/20 group hover:border-blue-200 transition-colors cursor-default">
                                    <div className="flex items-center text-blue-700 dark:text-blue-300 font-bold text-sm mb-1">
                                        <Wrench className="h-3.5 w-3.5 mr-2" />
                                        {ticket.equipment?.product?.name || 'Facility Infrastructure'}
                                    </div>
                                    <p className="text-[10px] font-mono text-blue-600/60 dark:text-blue-400/60">SN: {ticket.equipment?.serialNumber || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-[-10px] right-[-10px] h-20 w-20 bg-blue-600 rounded-full blur-[40px] opacity-20 transition-transform group-hover:scale-150 duration-700" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 relative z-10">Live SLA Status</p>
                                    <div className="flex items-center space-x-2 relative z-10">
                                        <div className={`h-2 w-2 rounded-full ${slaTone} shadow-[0_0_8px_rgba(34,197,94,0.5)]`} />
                                        <p className="text-xs font-semibold">{slaStateLabel}</p>
                                    </div>
                                    {sla && (
                                        <p className="text-[10px] text-slate-300 mt-2 relative z-10">
                                            Response target: {sla.responseTargetHours}h | Resolution target: {sla.resolutionTargetHours}h
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-blue-600">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Help Resources</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button variant="outline" className="w-full justify-start h-11 rounded-xl text-xs border-slate-100 hover:bg-slate-50 hover:text-blue-600 transition-all">
                                <ActivityIcon className="h-3.5 w-3.5 mr-3 text-slate-400" />
                                View Service Standards
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
