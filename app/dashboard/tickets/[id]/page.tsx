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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    ChevronLeft,
    MessageSquare,
    History,
    Wrench,
    Sparkles,
    User,
    Activity as ActivityIcon,
    CheckCircle2,
    AlertCircle,
    ArrowRightLeft,
    Calendar,
    Building
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AITicketSummary } from '@/components/tickets/AITicketSummary';

export default function TicketDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Status Update Dialog
    const [showStatusDialog, setShowStatusDialog] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Service Report Dialog
    const [showReportDialog, setShowReportDialog] = useState(false);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [reportData, setReportData] = useState({
        serviceNotes: '',
        partsReplaced: '',
        nextMaintenanceDate: '',
    });

    // Transfer Dialog
    const [showTransferDialog, setShowTransferDialog] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferData, setTransferData] = useState({
        toTechnicianId: '',
        reason: '',
    });

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const response = await fetch(`/api/tickets/${id}`);
            if (!response.ok) throw new Error('Failed to fetch ticket');
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
            toast.success('Comment added');
            setNewComment('');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch (error) {
            toast.error('Failed to add comment');
        } finally {
            setIsSubmittingComment(false);
        }
    };


    const handleUpdateStatus = async (status: string) => {
        setIsUpdatingStatus(true);
        try {
            const response = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!response.ok) throw new Error('Failed to update status');
            toast.success(`Status updated to ${status}`);
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            setShowStatusDialog(false);
        } catch (error) {
            toast.error('Failed to update status');
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleSubmitReport = async () => {
        if (!reportData.serviceNotes.trim()) {
            toast.error('Service notes are required');
            return;
        }
        setIsSubmittingReport(true);
        try {
            const response = await fetch('/api/service-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...reportData, ticketId: id }),
            });
            if (!response.ok) throw new Error('Failed to submit report');
            toast.success('Service report filed. Ticket resolved.');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            setShowReportDialog(false);
        } catch (error) {
            toast.error('Failed to submit service report');
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const { data: technicians } = useQuery({
        queryKey: ['technicians'],
        queryFn: async () => {
            const response = await fetch('/api/users/technicians');
            if (!response.ok) return [];
            return response.json();
        }
    });

    const handleTransfer = async () => {
        if (!transferData.toTechnicianId) {
            toast.error('Please select a technician');
            return;
        }
        setIsTransferring(true);
        try {
            const response = await fetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transferData),
            });
            if (!response.ok) throw new Error('Failed to transfer ticket');
            toast.success('Ticket transferred successfully');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            setShowTransferDialog(false);
        } catch (error) {
            toast.error('Failed to transfer ticket');
        } finally {
            setIsTransferring(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    if (!ticket) return <div className="text-center py-20"><h3 className="text-xl font-semibold">Ticket not found</h3></div>;

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Queue
                </Button>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setShowTransferDialog(true)}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Transfer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowStatusDialog(true)}>
                        <ActivityIcon className="h-4 w-4 mr-2" />
                        Update Status
                    </Button>
                    {ticket.status !== 'RESOLVED' && (
                        <Button size="sm" onClick={() => setShowReportDialog(true)} className="bg-green-600 hover:bg-green-700">
                            <Wrench className="h-4 w-4 mr-2" />
                            Complete & Resolve
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Ticket Info */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <Badge variant={ticket.priority === 'CRITICAL' ? 'destructive' : 'default'}>{ticket.priority}</Badge>
                                <p className="text-xs text-muted-foreground">ID: {ticket.id}</p>
                            </div>
                            <CardTitle className="text-2xl mt-2">{ticket.subject}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                                <Building className="h-4 w-4" />
                                {ticket.customer.hospitalName}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted/30 p-4 rounded-lg border">
                                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Insights Card */}
                    <AITicketSummary ticketId={id as string} />

                    {/* Activity/Comments Tabs */}
                    <Tabs defaultValue="activity" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
                            <TabsTrigger value="comments">Comments & Notes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="activity">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                                        {ticket.activities?.map((activity: any) => (
                                            <div key={activity.id} className="relative pl-8">
                                                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">{activity.eventType.replace(/_/g, ' ')}</p>
                                                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                                                    <p className="text-[10px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="comments" className="space-y-4">
                            <Card>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {ticket.activities?.filter((a: any) => a.eventType === 'COMMENT').map((comment: any) => (
                                            <div key={comment.id} className="bg-muted/30 p-3 rounded-lg border">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs font-bold">{comment.performedBy?.name || 'System User'}</p>
                                                    <p className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</p>
                                                </div>
                                                <p className="text-sm">{comment.description}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2 mt-4 pt-4 border-top">
                                        <Label>Add a Comment</Label>
                                        <Textarea
                                            placeholder="Type technician notes or customer updates here..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                        />
                                        <Button onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()}>
                                            {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right Column: Status & Assignment */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Ticket Lifecycle</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg border">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Current Status</p>
                                    <p className="font-semibold text-sm">{ticket.status}</p>
                                </div>
                                <div className={cn(
                                    "w-3 h-3 rounded-full animate-pulse",
                                    ticket.status === 'RESOLVED' ? "bg-green-500" :
                                        ticket.status === 'OPEN' ? "bg-red-500" : "bg-blue-500"
                                )} />
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Technician Assigned</p>
                                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                    <div className="bg-primary/10 p-2 rounded-full">
                                        <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{ticket.assignedTechnician?.name || 'Round Robin Queue'}</p>
                                        <p className="text-xs text-muted-foreground">Main Service Dept</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Equipment Context</p>
                                <div className="p-3 border rounded-lg bg-orange-50/20 dark:bg-orange-950/10 border-orange-100">
                                    <p className="text-sm font-medium">{ticket.equipment?.product?.name || 'General Support'}</p>
                                    <p className="text-xs text-muted-foreground">SN: {ticket.equipment?.serialNumber || 'N/A'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Service Reports</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {ticket.serviceReports?.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">No service reports filed for this ticket.</p>
                            ) : (
                                ticket.serviceReports.map((report: any) => (
                                    <div key={report.id} className="p-3 border rounded-lg text-xs space-y-2 hover:bg-muted/20 cursor-pointer">
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold">Summary Report</p>
                                            <Calendar className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                        <p className="line-clamp-2">{report.serviceNotes}</p>
                                        <p className="text-[9px] text-muted-foreground italic">Filed {new Date(report.createdAt).toLocaleDateString()}</p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Status Update Dialog */}
            <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Ticket Status</DialogTitle>
                        <DialogDescription>Move this ticket through the support lifecycle.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 py-4">
                        <Button variant="outline" onClick={() => handleUpdateStatus('IN_PROGRESS')} disabled={isUpdatingStatus}>IN_PROGRESS</Button>
                        <Button variant="outline" onClick={() => handleUpdateStatus('ASSIGNED')} disabled={isUpdatingStatus}>ASSIGNED</Button>
                        <Button variant="outline" onClick={() => handleUpdateStatus('OPEN')} disabled={isUpdatingStatus}>OPEN</Button>
                        <Button variant="outline" onClick={() => handleUpdateStatus('CLOSED')} disabled={isUpdatingStatus}>CLOSED</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Service Report Dialog */}
            <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                {/* ... existing content ... */}
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>Complete Service & File Report</DialogTitle>
                        <DialogDescription>Document the work performed. Saving this will mark the ticket as RESOLVED.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Service Notes (Detailed Work Performed)</Label>
                            <Textarea
                                id="notes"
                                value={reportData.serviceNotes}
                                onChange={(e) => setReportData({ ...reportData, serviceNotes: e.target.value })}
                                placeholder="e.g. Replaced motherboard and verified pulse oximeter calibration..."
                                className="h-32"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="parts">Parts Replaced / Used</Label>
                            <Input
                                id="parts"
                                value={reportData.partsReplaced}
                                onChange={(e) => setReportData({ ...reportData, partsReplaced: e.target.value })}
                                placeholder="e.g. Main motherboard v2.1, 2x AA Batteries"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="maint">Suggested Next Maintenance Date</Label>
                            <Input
                                id="maint"
                                type="date"
                                value={reportData.nextMaintenanceDate}
                                onChange={(e) => setReportData({ ...reportData, nextMaintenanceDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancel</Button>
                        <Button onClick={handleSubmitReport} disabled={isSubmittingReport} className="bg-green-600 hover:bg-green-700">
                            Confirm Resolution & File Report
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer Ticket Dialog */}
            <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transfer Support Ticket</DialogTitle>
                        <DialogDescription>Reassign this ticket to another specialized technician.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="technician">Select Technician</Label>
                            <select
                                id="technician"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={transferData.toTechnicianId}
                                onChange={(e) => setTransferData({ ...transferData, toTechnicianId: e.target.value })}
                            >
                                <option value="">Select a technician...</option>
                                {technicians?.map((tech: any) => (
                                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="reason">Reason for Transfer</Label>
                            <Textarea
                                id="reason"
                                placeholder="e.g. Technical specialization required for this unit type..."
                                value={transferData.reason}
                                onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
                        <Button onClick={handleTransfer} disabled={isTransferring}>
                            {isTransferring ? 'Transferring...' : 'Transfer Ticket'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
