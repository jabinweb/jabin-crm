'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { pushRecentEntity } from '@/lib/crm/recent-entities';
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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
    Building,
    GitMerge,
    SplitSquareHorizontal,
    Search,
    Loader2,
    Eye,
    EyeOff,
    Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFeatureModule } from '@/components/feature-module-guard';
import { DetailSkeleton } from '@/components/loading';

const TicketPhotoEvidence = dynamic(
  () => import('@/components/tickets/ticket-photo-evidence').then((mod) => mod.TicketPhotoEvidence),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-lg border bg-muted/40" /> }
);
const Customer360Strip = dynamic(
  () => import('@/components/crm/customer-360-strip').then((mod) => mod.Customer360Strip),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-lg border bg-muted/40" /> }
);
const AITicketSummary = dynamic(
  () => import('@/components/tickets/AITicketSummary').then((mod) => mod.AITicketSummary),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg border bg-muted/40" /> }
);
const SignaturePad = dynamic(
  () => import('@/components/service/signature-pad').then((mod) => mod.SignaturePad),
  { ssr: false, loading: () => <div className="h-28 animate-pulse rounded-lg border bg-muted/40" /> }
);

export default function TicketDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { path, workspaceFetch, slug } = useWorkspacePaths();
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const ticketAdvancedEnabled = useFeatureModule('TICKET_ADVANCED');
    const [newComment, setNewComment] = useState('');
    const [typingPeers, setTypingPeers] = useState<string[]>([]);
    const [optimisticComments, setOptimisticComments] = useState<
        Array<{ id: string; description: string; eventType: string; createdAt: string }>
    >([]);
    const [isInternalNote, setIsInternalNote] = useState(false);
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
        customerSignerName: '',
        signatureDataUrl: '',
    });
    const [partLines, setPartLines] = useState<Array<{ productId: string; quantity: number }>>([
        { productId: '', quantity: 1 },
    ]);

    // Transfer Dialog
    const [showTransferDialog, setShowTransferDialog] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferData, setTransferData] = useState({
        toTechnicianId: '',
        reason: '',
    });

    const [showMergeDialog, setShowMergeDialog] = useState(false);
    const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
    const [mergeSearch, setMergeSearch] = useState('');
    const [isMerging, setIsMerging] = useState(false);
    const [showSplitDialog, setShowSplitDialog] = useState(false);
    const [isSplitting, setIsSplitting] = useState(false);
    const [splitData, setSplitData] = useState({ subject: '', description: '' });
    const [watchBusy, setWatchBusy] = useState(false);
    const [guestBusy, setGuestBusy] = useState(false);
    const [companyFieldEdits, setCompanyFieldEdits] = useState<Record<string, string>>({});
    const [savingFields, setSavingFields] = useState(false);
    const [ticketTab, setTicketTab] = useState('activity');
    const [projectsSelectOpen, setProjectsSelectOpen] = useState(false);
    const [deferHeavyPanels, setDeferHeavyPanels] = useState(false);
    const typingRef = useRef(false);

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const response = await workspaceFetch(`/api/tickets/${id}`);
            if (!response.ok) throw new Error('Failed to fetch ticket');
            return response.json();
        },
        staleTime: 30_000,
    });

    const { data: watchData, refetch: refetchWatch } = useQuery({
        queryKey: ['ticket-watch', id],
        enabled: !!id,
        queryFn: async () => {
            const res = await workspaceFetch(`/api/tickets/${id}/watch`);
            if (!res.ok) return { watching: false, watchers: [] };
            return res.json() as Promise<{
                watching: boolean;
                watchers: Array<{ user?: { name?: string } }>;
            }>;
        },
        staleTime: 15_000,
    });

    const { data: presence, refetch: refetchPresence } = useQuery({
        queryKey: ['ticket-presence', id],
        enabled: !!id,
        queryFn: async () => {
            const res = await workspaceFetch(`/api/tickets/${id}/presence`);
            if (!res.ok) return null;
            return res.json() as Promise<{
                viewers: Array<{ id: string; name: string }>;
                guestAccessToken?: string | null;
                hasGuestLink?: boolean;
            }>;
        },
        // Heartbeat + realtime keep presence fresh; avoid a second 15s poll storm.
        staleTime: 30_000,
    });

    const { data: companyFieldDefs = [] } = useQuery({
        queryKey: ['ticket-custom-fields', id],
        enabled: !!id,
        queryFn: async () => {
            const res = await workspaceFetch('/api/support/custom-fields');
            if (!res.ok) return [];
            return res.json() as Promise<
                Array<{
                    id: string;
                    name: string;
                    key: string;
                    fieldType: string;
                    required: boolean;
                    options?: unknown;
                }>
            >;
        },
        staleTime: 60_000,
    });

    const { data: projectsList = [] } = useQuery({
        queryKey: ['projects-list-ticket-detail', slug],
        queryFn: async () => {
            const res = await workspaceFetch('/api/projects');
            if (!res.ok) return [];
            const data = await res.json();
            return (Array.isArray(data) ? data : []) as Array<{
                id: string;
                name: string;
                status: string;
            }>;
        },
        enabled: !!slug && projectsSelectOpen,
        staleTime: 60_000,
    });

    const saveProjectLink = async (projectId: string | null) => {
        try {
            const res = await workspaceFetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update project');
            }
            toast.success(projectId ? 'Project linked' : 'Project unlinked');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update project');
        }
    };

    useEffect(() => {
        const meta = ticket?.metadata;
        const fields =
            meta && typeof meta === 'object' && !Array.isArray(meta) && meta.customFields
                ? (meta.customFields as Record<string, string>)
                : {};
        setCompanyFieldEdits(fields || {});
    }, [ticket?.metadata]);

    useEffect(() => {
        typingRef.current = newComment.trim().length > 0;
    }, [newComment]);

    useEffect(() => {
        if (!ticket?.id) {
            setDeferHeavyPanels(false);
            return;
        }
        const timer = window.setTimeout(() => setDeferHeavyPanels(true), 350);
        return () => window.clearTimeout(timer);
    }, [ticket?.id]);

    useEffect(() => {
        if (!id) return;
        const tick = async () => {
            try {
                await workspaceFetch(`/api/tickets/${id}/presence`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'heartbeat', typing: typingRef.current }),
                });
                void refetchPresence();
            } catch {
                /* ignore */
            }
        };
        tick();
        const interval = setInterval(tick, 15_000);
        return () => clearInterval(interval);
    }, [id, workspaceFetch, refetchPresence]);

    useRealtime({
        types: [
            REALTIME_EVENTS.TICKET_COMMENT,
            REALTIME_EVENTS.TICKET_UPDATED,
            REALTIME_EVENTS.TICKET_TYPING,
            REALTIME_EVENTS.TICKET_PRESENCE,
        ],
        onEvent: (e) => {
            if (e.payload?.ticketId !== id) return;
            if (e.type === REALTIME_EVENTS.TICKET_TYPING) {
                const name =
                    typeof e.payload?.userName === 'string'
                        ? e.payload.userName
                        : typeof e.payload?.name === 'string'
                          ? e.payload.name
                          : 'Someone';
                const typing = Boolean(e.payload?.typing);
                const uid = e.userId;
                if (uid && uid === session?.user?.id) return;
                setTypingPeers((prev) => {
                    if (typing) return Array.from(new Set([...prev, name]));
                    return prev.filter((n) => n !== name);
                });
                return;
            }
            if (e.type === REALTIME_EVENTS.TICKET_PRESENCE) {
                void queryClient.invalidateQueries({ queryKey: ['ticket-presence', id] });
                return;
            }
            void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            void queryClient.invalidateQueries({ queryKey: ['ticket-presence', id] });
            setOptimisticComments([]);
        },
    });

    useEffect(() => {
        if (!ticket?.id) return;
        pushRecentEntity({
            id: ticket.id,
            type: 'ticket',
            label: ticket.subject,
            href: path(`/dashboard/tickets/${ticket.id}`),
        });
    }, [ticket?.id, ticket?.subject, path]);

    const toggleWatch = async () => {
        setWatchBusy(true);
        try {
            const watching = watchData?.watching;
            const res = await workspaceFetch(`/api/tickets/${id}/watch`, {
                method: watching ? 'DELETE' : 'POST',
            });
            if (!res.ok) throw new Error('Failed to update watch');
            toast.success(watching ? 'Unwatched' : 'Watching ticket');
            await refetchWatch();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Watch failed');
        } finally {
            setWatchBusy(false);
        }
    };

    const copyGuestLink = async () => {
        setGuestBusy(true);
        try {
            const res = await workspaceFetch(`/api/tickets/${id}/presence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'guest_link' }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || 'Failed to create guest link');
            const token = body.token as string;
            const url = `${window.location.origin}/ticket/${token}`;
            await navigator.clipboard.writeText(url);
            toast.success('Guest link copied');
            await refetchPresence();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Guest link failed');
        } finally {
            setGuestBusy(false);
        }
    };

    const revokeGuestLink = async () => {
        setGuestBusy(true);
        try {
            const res = await workspaceFetch(`/api/tickets/${id}/presence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'revoke_guest_link' }),
            });
            if (!res.ok) throw new Error('Failed to revoke');
            toast.success('Guest link revoked');
            await refetchPresence();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Revoke failed');
        } finally {
            setGuestBusy(false);
        }
    };

    const rotateGuestLink = async () => {
        setGuestBusy(true);
        try {
            const res = await workspaceFetch(`/api/tickets/${id}/presence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rotate_guest_link' }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || 'Failed to rotate');
            const token = body.token as string;
            await navigator.clipboard.writeText(`${window.location.origin}/ticket/${token}`);
            toast.success('New guest link copied (old link invalidated)');
            await refetchPresence();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Rotate failed');
        } finally {
            setGuestBusy(false);
        }
    };

    const saveCompanyFields = async () => {
        setSavingFields(true);
        try {
            const res = await workspaceFetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customFields: companyFieldEdits }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save fields');
            }
            toast.success('Custom fields saved');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSavingFields(false);
        }
    };

    const { data: mergeCandidates = [], isFetching: mergeLoading } = useQuery({
        queryKey: ['tickets-merge-picker', mergeSearch, id],
        enabled: showMergeDialog,
        queryFn: async () => {
            const params = new URLSearchParams({ limit: '40' });
            if (mergeSearch.trim()) params.set('q', mergeSearch.trim());
            const response = await workspaceFetch(`/api/tickets?${params}`);
            if (!response.ok) return [];
            const tickets = await response.json();
            return (Array.isArray(tickets) ? tickets : []).filter(
                (t: { id: string }) => t.id !== id
            ) as Array<{
                id: string;
                subject: string;
                status: string;
                customer?: { organizationName?: string };
            }>;
        },
        staleTime: 15_000,
    });

    const { data: cannedResponses } = useQuery({
        queryKey: ['canned-responses'],
        enabled: ticketTab === 'comments',
        queryFn: async () => {
            const response = await workspaceFetch('/api/support/canned-responses');
            if (!response.ok) return [];
            return response.json();
        },
        staleTime: 60_000,
    });

    const { data: sla } = useQuery({
        queryKey: ['ticket-sla', id],
        enabled: !!id,
        queryFn: async () => {
            const response = await workspaceFetch(`/api/tickets/${id}/sla`);
            if (!response.ok) return null;
            return response.json();
        },
        staleTime: 30_000,
    });

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        const text = newComment.trim();
        const tempId = `opt-${Date.now()}`;
        setOptimisticComments((prev) => [
            {
                id: tempId,
                description: text,
                eventType: isInternalNote ? 'INTERNAL_NOTE' : 'COMMENT',
                createdAt: new Date().toISOString(),
            },
            ...prev,
        ]);
        setNewComment('');
        setIsSubmittingComment(true);
        try {
            const response = await workspaceFetch(`/api/tickets/${id}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: text, isInternal: isInternalNote }),
            });
            if (!response.ok) throw new Error('Failed to add comment');
            toast.success(isInternalNote ? 'Internal note saved' : 'Reply sent');
            setIsInternalNote(false);
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
        } catch (error) {
            setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
            setNewComment(text);
            toast.error('Failed to add comment');
        } finally {
            setIsSubmittingComment(false);
        }
    };


    const handleUpdateStatus = async (status: string) => {
        setIsUpdatingStatus(true);
        try {
            const response = await workspaceFetch(`/api/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    typeof body.error === 'string' ? body.error : 'Failed to update status'
                );
            }
            toast.success(`Status updated to ${status}`);
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            setShowStatusDialog(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update status');
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
            const parts = partLines
                .filter((l) => l.productId && l.quantity > 0)
                .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));

            const response = await workspaceFetch('/api/service-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: id,
                    serviceNotes: reportData.serviceNotes,
                    partsReplaced: reportData.partsReplaced || undefined,
                    nextMaintenanceDate: reportData.nextMaintenanceDate || undefined,
                    parts,
                    customerSignerName: reportData.customerSignerName || undefined,
                    signatureDataUrl: reportData.signatureDataUrl || undefined,
                }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(typeof body.error === 'string' ? body.error : 'Failed to submit report');
            }
            toast.success('Service report filed. Ticket resolved.');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            setShowReportDialog(false);
            setPartLines([{ productId: '', quantity: 1 }]);
            setReportData({
                serviceNotes: '',
                partsReplaced: '',
                nextMaintenanceDate: '',
                customerSignerName: '',
                signatureDataUrl: '',
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to submit service report');
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const { data: technicians } = useQuery({
        queryKey: ['technicians'],
        enabled: showTransferDialog,
        queryFn: async () => {
            const response = await workspaceFetch('/api/users/technicians');
            if (!response.ok) return [];
            return response.json();
        },
        staleTime: 60_000,
    });

    const { data: consumableProducts = [] } = useQuery({
        queryKey: ['consumable-products'],
        enabled: showReportDialog,
        queryFn: async () => {
            const response = await workspaceFetch('/api/products');
            if (!response.ok) return [];
            const products = await response.json();
            const list = Array.isArray(products) ? products : products?.data || products?.products || [];
            return (list as Array<{ id: string; name: string; quantity: number; type?: string; sku?: string }>);
        },
        staleTime: 30_000,
    });

    const handleTransfer = async () => {
        if (!transferData.toTechnicianId) {
            toast.error('Please select a technician');
            return;
        }
        setIsTransferring(true);
        try {
            const response = await workspaceFetch(`/api/tickets/${id}`, {
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

    const handleMerge = async () => {
        if (mergeSelectedIds.length === 0) {
            toast.error('Select at least one ticket to merge');
            return;
        }
        setIsMerging(true);
        try {
            const response = await workspaceFetch(`/api/tickets/${id}/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketIds: mergeSelectedIds }),
            });
            if (!response.ok) throw new Error('Merge failed');
            toast.success(`Merged ${mergeSelectedIds.length} ticket(s)`);
            setShowMergeDialog(false);
            setMergeSelectedIds([]);
            setMergeSearch('');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch {
            toast.error('Failed to merge tickets');
        } finally {
            setIsMerging(false);
        }
    };

    const toggleMergeId = (ticketId: string) => {
        setMergeSelectedIds((prev) =>
            prev.includes(ticketId) ? prev.filter((x) => x !== ticketId) : [...prev, ticketId]
        );
    };

    const handleSplit = async () => {
        if (!splitData.subject.trim() || !splitData.description.trim()) {
            toast.error('Subject and description required');
            return;
        }
        setIsSplitting(true);
        try {
            const response = await workspaceFetch(`/api/tickets/${id}/split`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(splitData),
            });
            if (!response.ok) throw new Error('Split failed');
            const newTicket = await response.json();
            toast.success('New ticket created from split');
            setShowSplitDialog(false);
            router.push(path(`/dashboard/tickets/${newTicket.id}`));
        } catch {
            toast.error('Failed to split ticket');
        } finally {
            setIsSplitting(false);
        }
    };

    if (isLoading) {
        return <DetailSkeleton />;
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
                    {ticketAdvancedEnabled && (
                        <>
                    <Button variant="outline" size="sm" onClick={() => setShowMergeDialog(true)}>
                        <GitMerge className="h-4 w-4 mr-2" />
                        Merge
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowSplitDialog(true)}>
                        <SplitSquareHorizontal className="h-4 w-4 mr-2" />
                        Split
                    </Button>
                        </>
                    )}
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
                                {ticket.customer?.id ? (
                                  <Link
                                    href={path(`/dashboard/customers/${ticket.customer.id}`)}
                                    className="hover:underline text-primary"
                                  >
                                    {ticket.customer.organizationName}
                                  </Link>
                                ) : (
                                  ticket.customer?.organizationName || '—'
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted/30 p-4 rounded-lg border">
                                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {deferHeavyPanels && ticket.customer?.id ? (
                    <Customer360Strip customerId={ticket.customer?.id} />
                    ) : null}

                    {/* AI Insights Card */}
                    <AITicketSummary ticketId={id as string} />

                    {/* Activity/Comments Tabs */}
                    <Tabs
                        value={ticketTab}
                        onValueChange={setTicketTab}
                        className="space-y-4"
                    >
                        <TabsList>
                            <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
                            <TabsTrigger value="comments">Comments & Notes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="activity">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                                        {ticket.activities
                                            ?.filter((a: { eventType: string }) => a.eventType !== 'PRESENCE')
                                            .map((activity: { id: string; eventType: string; description: string; createdAt: string }) => (
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
                                        {ticket.activities?.filter((a: any) => ['COMMENT', 'INTERNAL_NOTE', 'EMAIL_REPLY'].includes(a.eventType)).map((comment: any) => (
                                            <div key={comment.id} className={cn(
                                                "p-3 rounded-lg border",
                                                comment.isInternal ? "bg-amber-50/50 border-amber-200" : "bg-muted/30"
                                            )}>
                                                <div className="flex items-center justify-between mb-1 gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-bold">{comment.performedBy?.name || 'System User'}</p>
                                                        {comment.isInternal && (
                                                            <Badge variant="outline" className="text-[9px] h-4">Internal</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</p>
                                                </div>
                                                <p className="text-sm">{comment.description}</p>
                                            </div>
                                        ))}
                                        {optimisticComments.map((comment) => (
                                            <div
                                                key={comment.id}
                                                className="p-3 rounded-lg border bg-muted/10 opacity-70"
                                            >
                                                <p className="text-[10px] text-muted-foreground mb-1">Sending…</p>
                                                <p className="text-sm">{comment.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {typingPeers.length > 0 && (
                                        <p className="text-xs text-muted-foreground italic px-1">
                                            {typingPeers.join(', ')} typing…
                                        </p>
                                    )}

                                    {cannedResponses?.length > 0 && (
                                        <div className="space-y-2">
                                            <Label>Canned response</Label>
                                            <Select onValueChange={(val) => {
                                                const item = cannedResponses.find((r: any) => r.id === val);
                                                if (item) setNewComment(item.body);
                                            }}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Insert template…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cannedResponses.map((r: any) => (
                                                        <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2 mt-4 pt-4 border-t">
                                        <Label>{isInternalNote ? 'Internal note (agents only)' : 'Public reply'}</Label>
                                        <Textarea
                                            placeholder={isInternalNote ? 'Private note for your team…' : 'Reply visible to the customer…'}
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                        />
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    id="internal-note"
                                                    checked={isInternalNote}
                                                    onCheckedChange={setIsInternalNote}
                                                />
                                                <Label htmlFor="internal-note" className="text-sm font-normal">Internal note</Label>
                                            </div>
                                            <Button onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()}>
                                                {isSubmittingComment ? 'Posting…' : isInternalNote ? 'Save note' : 'Send reply'}
                                            </Button>
                                        </div>
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
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">SLA Status</p>
                                <div className="p-3 border rounded-lg text-xs space-y-1">
                                    <p className="font-medium">{sla?.state ? String(sla.state).replace(/_/g, ' ') : 'Monitoring'}</p>
                                    {sla && (
                                        <p className="text-muted-foreground">
                                            Response: {sla.responseTargetHours}h · Resolution: {sla.resolutionTargetHours}h
                                        </p>
                                    )}
                                </div>
                            </div>

                            {ticket.csatRating && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Customer satisfaction</p>
                                    <div className="p-3 border rounded-lg text-xs">
                                        <p className="font-medium">{ticket.csatRating} / 5 stars</p>
                                        {ticket.csatComment && <p className="text-muted-foreground mt-1">{ticket.csatComment}</p>}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Equipment Context</p>
                                <div className="p-3 border rounded-lg bg-orange-50/20 dark:bg-orange-950/10 border-orange-100">
                                    <p className="text-sm font-medium">{ticket.equipment?.product?.name || 'General Support'}</p>
                                    <p className="text-xs text-muted-foreground">SN: {ticket.equipment?.serialNumber || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Project</p>
                                <Select
                                    value={ticket.projectId || ticket.project?.id || '__none__'}
                                    onOpenChange={setProjectsSelectOpen}
                                    onValueChange={(val) =>
                                        void saveProjectLink(val === '__none__' ? null : val)
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Link project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No project</SelectItem>
                                        {projectsList.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {(ticket.projectId || ticket.project?.id) && (
                                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                                        <Link
                                            href={path(
                                                `/dashboard/projects/${ticket.projectId || ticket.project?.id}`
                                            )}
                                        >
                                            Open project
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Collaboration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium">Watch</p>
                                    <p className="text-xs text-muted-foreground">
                                        {watchData?.watchers?.length
                                            ? `${watchData.watchers.length} watcher(s)`
                                            : 'Get notified on updates'}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant={watchData?.watching ? 'default' : 'outline'}
                                    disabled={watchBusy}
                                    onClick={toggleWatch}
                                >
                                    {watchData?.watching ? (
                                        <>
                                            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                                            Unwatch
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                                            Watch
                                        </>
                                    )}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Viewing now
                                </p>
                                {presence?.viewers?.length ? (
                                    <div className="flex flex-wrap gap-1">
                                        {presence.viewers.map((v) => (
                                            <Badge key={v.id} variant="secondary" className="text-[10px]">
                                                {v.name}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Only you</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Guest link
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {presence?.hasGuestLink || presence?.guestAccessToken
                                        ? 'Active — anyone with the link can reply'
                                        : 'No guest link yet'}
                                </p>
                                <div className="flex flex-col gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full"
                                        disabled={guestBusy}
                                        onClick={copyGuestLink}
                                    >
                                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                                        {guestBusy ? 'Working…' : 'Copy guest link'}
                                    </Button>
                                    {(presence?.hasGuestLink || presence?.guestAccessToken) && (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="flex-1"
                                                disabled={guestBusy}
                                                onClick={rotateGuestLink}
                                            >
                                                Rotate
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="flex-1"
                                                disabled={guestBusy}
                                                onClick={revokeGuestLink}
                                            >
                                                Revoke
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {companyFieldDefs.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">Custom fields</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {companyFieldDefs.map((field) => (
                                    <div key={field.id} className="space-y-1">
                                        <Label className="text-xs">
                                            {field.name}
                                            {field.required ? ' *' : ''}
                                        </Label>
                                        {field.fieldType === 'boolean' ? (
                                            <Select
                                                value={companyFieldEdits[field.key] || 'false'}
                                                onValueChange={(v) =>
                                                    setCompanyFieldEdits((prev) => ({
                                                        ...prev,
                                                        [field.key]: v,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Yes</SelectItem>
                                                    <SelectItem value="false">No</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                type={
                                                    field.fieldType === 'number'
                                                        ? 'number'
                                                        : field.fieldType === 'date'
                                                          ? 'date'
                                                          : 'text'
                                                }
                                                value={companyFieldEdits[field.key] ?? ''}
                                                onChange={(e) =>
                                                    setCompanyFieldEdits((prev) => ({
                                                        ...prev,
                                                        [field.key]: e.target.value,
                                                    }))
                                                }
                                            />
                                        )}
                                    </div>
                                ))}
                                <Button
                                    size="sm"
                                    disabled={savingFields}
                                    onClick={saveCompanyFields}
                                >
                                    {savingFields ? 'Saving…' : 'Save fields'}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {deferHeavyPanels ? <TicketPhotoEvidence ticketId={String(id)} /> : null}

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
                        <Button variant="outline" onClick={() => handleUpdateStatus('RESOLVED')} disabled={isUpdatingStatus}>RESOLVED</Button>
                        <Button variant="outline" onClick={() => handleUpdateStatus('CLOSED')} disabled={isUpdatingStatus}>CLOSED</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Service Report Dialog */}
            <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                {/* ... existing content ... */}
                <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
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
                                placeholder="Describe work performed, parts used, and verification steps…"
                                className="h-32"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Parts used (stock OUT)</Label>
                            <div className="space-y-2">
                                {partLines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={line.productId}
                                            onChange={(e) => {
                                                const next = [...partLines];
                                                next[idx] = { ...next[idx], productId: e.target.value };
                                                setPartLines(next);
                                            }}
                                        >
                                            <option value="">Select product…</option>
                                            {consumableProducts.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} (qty {p.quantity}
                                                    {p.sku ? ` · ${p.sku}` : ''})
                                                </option>
                                            ))}
                                        </select>
                                        <Input
                                            type="number"
                                            min={1}
                                            className="w-20"
                                            value={line.quantity}
                                            onChange={(e) => {
                                                const next = [...partLines];
                                                next[idx] = {
                                                    ...next[idx],
                                                    quantity: Math.max(1, Number(e.target.value) || 1),
                                                };
                                                setPartLines(next);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setPartLines(partLines.filter((_, i) => i !== idx))
                                            }
                                            disabled={partLines.length <= 1}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setPartLines([...partLines, { productId: '', quantity: 1 }])
                                    }
                                >
                                    Add part line
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="parts">Parts notes (optional free text)</Label>
                            <Input
                                id="parts"
                                value={reportData.partsReplaced}
                                onChange={(e) => setReportData({ ...reportData, partsReplaced: e.target.value })}
                                placeholder="Extra notes if parts are not in catalogue"
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
                        <div className="grid gap-2">
                            <Label htmlFor="signer">Customer signer name (optional)</Label>
                            <Input
                                id="signer"
                                value={reportData.customerSignerName}
                                onChange={(e) =>
                                    setReportData({ ...reportData, customerSignerName: e.target.value })
                                }
                                placeholder="Name for sign-off"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Customer signature (optional)</Label>
                            <SignaturePad
                                value={reportData.signatureDataUrl}
                                onChange={(dataUrl) =>
                                    setReportData({ ...reportData, signatureDataUrl: dataUrl })
                                }
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

            <Dialog
                open={showMergeDialog}
                onOpenChange={(open) => {
                    setShowMergeDialog(open);
                    if (!open) {
                        setMergeSelectedIds([]);
                        setMergeSearch('');
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Merge tickets</DialogTitle>
                        <DialogDescription>
                            Select other open tickets to combine into this one.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={mergeSearch}
                                onChange={(e) => setMergeSearch(e.target.value)}
                                placeholder="Search by subject, customer, or ID…"
                                className="pl-8"
                            />
                        </div>
                        {mergeSelectedIds.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                                {mergeSelectedIds.length} selected
                            </p>
                        ) : null}
                        <ScrollArea className="h-64 rounded-md border">
                            {mergeLoading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading…
                                </div>
                            ) : mergeCandidates.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    No matching tickets
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {mergeCandidates.map((t) => {
                                        const checked = mergeSelectedIds.includes(t.id);
                                        return (
                                            <li key={t.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleMergeId(t.id)}
                                                    className={cn(
                                                        'flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50',
                                                        checked && 'bg-muted/40'
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        className="mt-1"
                                                        onCheckedChange={() => toggleMergeId(t.id)}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium">
                                                            {t.subject}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {t.customer?.organizationName || '—'} · {t.status}
                                                        </p>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMerge}
                            disabled={isMerging || mergeSelectedIds.length === 0}
                        >
                            {isMerging
                                ? 'Merging…'
                                : `Merge ${mergeSelectedIds.length || ''} into this`.trim()}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Split ticket</DialogTitle>
                        <DialogDescription>Create a new ticket from part of this request.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>New subject</Label>
                            <Input
                                value={splitData.subject}
                                onChange={(e) => setSplitData((s) => ({ ...s, subject: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Textarea
                                value={splitData.description}
                                onChange={(e) => setSplitData((s) => ({ ...s, description: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSplitDialog(false)}>Cancel</Button>
                        <Button onClick={handleSplit} disabled={isSplitting}>
                            {isSplitting ? 'Creating…' : 'Create split ticket'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
