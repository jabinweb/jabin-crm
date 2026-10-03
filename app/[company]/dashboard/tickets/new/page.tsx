'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    ChevronLeft,
    Ticket,
    Building,
    Wrench,
    AlertCircle,
    Info,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { PortalTicketTypeDefinition } from '@/lib/support/ticket-types';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function NewTicketPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { slug, path, workspaceFetch } = useWorkspacePaths();
    const initialCustomerId = searchParams.get('customerId') || '';
    const initialProjectId = searchParams.get('projectId') || '';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        customerId: initialCustomerId,
        projectId: initialProjectId,
        ticketType: '',
        equipmentId: '',
        serviceContractId: '',
        subject: '',
        description: '',
        priority: 'MEDIUM',
        customFields: {} as Record<string, string>,
    });

    const { data: ticketTypeData } = useQuery({
        queryKey: ['support-ticket-types', slug],
        queryFn: async () => {
            const response = await workspaceFetch('/api/support/ticket-types');
            if (!response.ok) throw new Error('Failed to load ticket types');
            return response.json() as Promise<{ ticketTypes: PortalTicketTypeDefinition[] }>;
        },
    });

    const { data: companyCustomFields = [] } = useQuery({
        queryKey: ['ticket-custom-fields-new'],
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
                    options?: string[] | null;
                }>
            >;
        },
    });

    const ticketTypes = ticketTypeData?.ticketTypes ?? [];

    const selectedType = useMemo(
        () => ticketTypes.find((t) => t.id === formData.ticketType),
        [ticketTypes, formData.ticketType]
    );

    useEffect(() => {
        if (ticketTypes.length && !formData.ticketType) {
            setFormData((prev) => ({
                ...prev,
                ticketType: ticketTypes[0].id,
                priority: ticketTypes[0].defaultPriority,
            }));
        }
    }, [ticketTypes, formData.ticketType]);

    // 1. Fetch Customers for and initialization
    const { data: customerData, isLoading: isLoadingCustomers } = useQuery({
        queryKey: ['customers-list', slug],
        queryFn: async () => {
            const response = await workspaceFetch('/api/customers?limit=100');
            if (!response.ok) throw new Error('Failed to fetch customers');
            return response.json();
        },
    });

    // 2. Fetch specific customer to get their equipment if selected
    const { data: selectedCustomer, isLoading: isLoadingEquipment } = useQuery({
        queryKey: ['customer-equipment', slug, formData.customerId],
        queryFn: async () => {
            if (!formData.customerId) return null;
            const response = await workspaceFetch(`/api/customers/${formData.customerId}`);
            if (!response.ok) throw new Error('Failed to fetch customer equipment');
            return response.json();
        },
        enabled: !!formData.customerId,
    });

    const { data: contractSuggest } = useQuery({
        queryKey: ['contracts-suggest', slug, formData.customerId, formData.equipmentId],
        queryFn: async () => {
            const params = new URLSearchParams({ customerId: formData.customerId });
            if (formData.equipmentId) params.set('equipmentId', formData.equipmentId);
            const res = await workspaceFetch(`/api/contracts/suggest?${params}`);
            if (!res.ok) return { contracts: [] };
            return res.json() as Promise<{
                contracts: Array<{
                    id: string;
                    title: string;
                    type: string;
                    visitLimit: number | null;
                    visitsUsed: number;
                    remaining: number | null;
                    overLimit: boolean;
                }>;
            }>;
        },
        enabled: !!formData.customerId && !!slug,
    });

    const { data: projectsList = [] } = useQuery({
        queryKey: ['projects-list-ticket', slug],
        queryFn: async () => {
            const res = await workspaceFetch('/api/projects');
            if (!res.ok) return [];
            const data = await res.json();
            return (Array.isArray(data) ? data : data.projects || []) as Array<{
                id: string;
                name: string;
                status: string;
                customerId?: string | null;
            }>;
        },
        enabled: !!slug,
    });

    const projectsForCustomer = useMemo(() => {
        if (!formData.customerId) return projectsList;
        return projectsList.filter(
            (p) => !p.customerId || p.customerId === formData.customerId
        );
    }, [projectsList, formData.customerId]);

    const suggestedContracts = contractSuggest?.contracts ?? [];

    useEffect(() => {
        const list = contractSuggest?.contracts;
        if (!list?.length) {
            setFormData((prev) =>
                prev.serviceContractId ? { ...prev, serviceContractId: '' } : prev
            );
            return;
        }
        setFormData((prev) => {
            if (prev.serviceContractId && list.some((c) => c.id === prev.serviceContractId)) {
                return prev;
            }
            return { ...prev, serviceContractId: list[0].id };
        });
    }, [contractSuggest?.contracts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.ticketType || !formData.subject || !formData.description) {
            toast.error('Please fill in all required fields');
            return;
        }
        for (const field of companyCustomFields) {
            if (field.required && !(formData.customFields[field.key]?.trim())) {
                toast.error(`${field.name} is required`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const response = await workspaceFetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    equipmentId: selectedType?.showEquipment ? formData.equipmentId : undefined,
                    serviceContractId: formData.serviceContractId || null,
                    projectId: formData.projectId || null,
                }),
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(typeof body.error === 'string' ? body.error : 'Failed to create ticket');
            }

            const ticket = body;
            toast.success(
                ticket.assignedTechnician?.name
                    ? `Ticket created and assigned to ${ticket.assignedTechnician.name}`
                    : 'Ticket created'
            );
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            router.push(path(`/dashboard/tickets/${ticket.id}`));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex flex-col items-start gap-2">
                <Button variant="ghost" size="sm" className="-ml-3" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New support ticket</h1>
                    <p className="text-sm text-muted-foreground">Log a support request with the right category and routing.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left side: Main details */}
                    <div className="md:col-span-2 space-y-6 min-w-0">
                        <Card className="border-t-4 border-t-primary shadow-none overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="text-lg flex items-center">
                                    <Ticket className="h-5 w-5 mr-2 text-primary" />
                                    Issue details
                                </CardTitle>
                                <CardDescription>What is going wrong, and what has the customer already tried?</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="e.g. Unable to log in after password reset"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        className="text-lg focus-visible:ring-primary"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Describe the issue, steps to reproduce, or symptoms..."
                                        className="min-h-[200px] focus-visible:ring-primary"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right side: Selection & Context */}
                    <div className="space-y-6 min-w-0">
                        <Card className="shadow-none">
                            <CardHeader className="pb-3 bg-muted/20">
                                <CardTitle className="text-sm font-semibold flex items-center">
                                    <Building className="h-4 w-4 mr-2" />
                                    Customer & context
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ticket-type">Request category</Label>
                                    <Select
                                        value={formData.ticketType}
                                        onValueChange={(val) => {
                                            const type = ticketTypes.find((t) => t.id === val);
                                            setFormData({
                                                ...formData,
                                                ticketType: val,
                                                priority: type?.defaultPriority ?? formData.priority,
                                                equipmentId: '',
                                                customFields: {},
                                            });
                                        }}
                                    >
                                        <SelectTrigger id="ticket-type" className="w-full">
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ticketTypes.map((type) => (
                                                <SelectItem key={type.id} value={type.id}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ticket-customer">Customer <span className="text-destructive" aria-hidden="true">*</span></Label>
                                    <Select
                                        value={formData.customerId}
                                        onValueChange={(val) =>
                                            setFormData({
                                                ...formData,
                                                customerId: val,
                                                equipmentId: '',
                                                serviceContractId: '',
                                                projectId:
                                                    formData.projectId &&
                                                    projectsList.some(
                                                        (p) =>
                                                            p.id === formData.projectId &&
                                                            (!p.customerId || p.customerId === val)
                                                    )
                                                        ? formData.projectId
                                                        : '',
                                            })
                                        }
                                    >
                                        <SelectTrigger id="ticket-customer" className="w-full" aria-required="true">
                                            <SelectValue placeholder={isLoadingCustomers ? "Loading customers…" : "Select customer"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customerData?.customers?.map((customer: any) => (
                                                <SelectItem key={customer.id} value={customer.id}>
                                                    {customer.organizationName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {!isLoadingCustomers && !customerData?.customers?.length ? (
                                        <p className="text-xs text-muted-foreground">
                                            No customers yet.{' '}
                                            <Link
                                                href={path('/dashboard/customers/new')}
                                                className="text-primary underline underline-offset-2"
                                            >
                                                Add a customer
                                            </Link>{' '}
                                            to log a ticket for them.
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ticket-project">Project (optional)</Label>
                                    <Select
                                        value={formData.projectId || '__none__'}
                                        onValueChange={(val) =>
                                            setFormData({
                                                ...formData,
                                                projectId: val === '__none__' ? '' : val,
                                            })
                                        }
                                    >
                                        <SelectTrigger id="ticket-project" className="w-full">
                                            <SelectValue placeholder="Link to a project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No project</SelectItem>
                                            {projectsForCustomer.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedType?.showEquipment ? (
                                <div className="space-y-2">
                                    <Label htmlFor="ticket-equipment">Equipment (optional)</Label>
                                    <Select
                                        value={formData.equipmentId}
                                        onValueChange={(val) =>
                                            setFormData({ ...formData, equipmentId: val, serviceContractId: '' })
                                        }
                                        disabled={!formData.customerId || isLoadingEquipment}
                                    >
                                        <SelectTrigger id="ticket-equipment" className="w-full">
                                            <SelectValue placeholder={
                                                !formData.customerId ? "Select a customer first" :
                                                    isLoadingEquipment ? "Loading equipment…" :
                                                        selectedCustomer?.equipmentInstallations?.length === 0 ? "No equipment found" :
                                                            "Select equipment"
                                            } />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedCustomer?.equipmentInstallations?.map((eq: any) => (
                                                <SelectItem key={eq.id} value={eq.id}>
                                                    {eq.product?.name} (SN: {eq.serialNumber})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                ) : null}

                                {formData.customerId && suggestedContracts.length > 0 ? (
                                <div className="space-y-2">
                                    <Label htmlFor="ticket-contract">Link to contract</Label>
                                    <Select
                                        value={formData.serviceContractId || 'none'}
                                        onValueChange={(val) =>
                                            setFormData({
                                                ...formData,
                                                serviceContractId: val === 'none' ? '' : val,
                                            })
                                        }
                                    >
                                        <SelectTrigger id="ticket-contract" className="w-full">
                                            <SelectValue placeholder="Select contract" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No contract</SelectItem>
                                            {suggestedContracts.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.type}: {c.title}
                                                    {c.visitLimit != null
                                                        ? ` (${c.visitsUsed}/${c.visitLimit} visits)`
                                                        : ''}
                                                    {c.overLimit ? ' — over limit' : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                ) : null}

                                {selectedType?.showEquipment &&
                                    formData.customerId &&
                                    !isLoadingEquipment &&
                                    selectedCustomer?.equipmentInstallations?.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            No equipment records found for this customer.
                                        </p>
                                    )}

                                {selectedType?.fields.map((field) => (
                                    <div key={field.id} className="space-y-2">
                                        <Label htmlFor={`tt-${field.id}`}>{field.label}{field.required ? ' *' : ''}</Label>
                                        {field.type === 'textarea' ? (
                                            <Textarea
                                                id={`tt-${field.id}`}
                                                value={formData.customFields[field.id] ?? ''}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        customFields: {
                                                            ...formData.customFields,
                                                            [field.id]: e.target.value,
                                                        },
                                                    })
                                                }
                                                placeholder={field.placeholder}
                                                required={field.required}
                                            />
                                        ) : (
                                            <Input
                                                id={`tt-${field.id}`}
                                                value={formData.customFields[field.id] ?? ''}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        customFields: {
                                                            ...formData.customFields,
                                                            [field.id]: e.target.value,
                                                        },
                                                    })
                                                }
                                                placeholder={field.placeholder}
                                                required={field.required}
                                            />
                                        )}
                                    </div>
                                ))}

                                {companyCustomFields.map((field) => (
                                    <div key={field.id} className="space-y-2">
                                        <Label htmlFor={`cf-${field.key}`}>
                                            {field.name}
                                            {field.required ? ' *' : ''}
                                        </Label>
                                        {field.fieldType === 'boolean' ? (
                                            <Select
                                                value={formData.customFields[field.key] || 'false'}
                                                onValueChange={(val) =>
                                                    setFormData({
                                                        ...formData,
                                                        customFields: {
                                                            ...formData.customFields,
                                                            [field.key]: val,
                                                        },
                                                    })
                                                }
                                            >
                                                <SelectTrigger id={`cf-${field.key}`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Yes</SelectItem>
                                                    <SelectItem value="false">No</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : field.fieldType === 'select' &&
                                          Array.isArray(field.options) ? (
                                            <Select
                                                value={formData.customFields[field.key] || ''}
                                                onValueChange={(val) =>
                                                    setFormData({
                                                        ...formData,
                                                        customFields: {
                                                            ...formData.customFields,
                                                            [field.key]: val,
                                                        },
                                                    })
                                                }
                                            >
                                                <SelectTrigger id={`cf-${field.key}`}>
                                                    <SelectValue placeholder="Select…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {field.options.map((opt) => (
                                                        <SelectItem key={opt} value={opt}>
                                                            {opt}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                id={`cf-${field.key}`}
                                                type={
                                                    field.fieldType === 'number'
                                                        ? 'number'
                                                        : field.fieldType === 'date'
                                                          ? 'date'
                                                          : 'text'
                                                }
                                                value={formData.customFields[field.key] ?? ''}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        customFields: {
                                                            ...formData.customFields,
                                                            [field.key]: e.target.value,
                                                        },
                                                    })
                                                }
                                                required={field.required}
                                            />
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="shadow-none">
                            <CardHeader className="pb-3 bg-muted/20">
                                <CardTitle className="text-sm font-semibold flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    Priority & routing
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ticket-priority">Priority</Label>
                                    <Select
                                        value={formData.priority}
                                        onValueChange={(val) => setFormData({ ...formData, priority: val })}
                                    >
                                        <SelectTrigger id="ticket-priority" className="w-full">
                                            <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LOW">Low — question or minor request</SelectItem>
                                            <SelectItem value="MEDIUM">Medium — normal issue</SelectItem>
                                            <SelectItem value="HIGH">High — major business impact</SelectItem>
                                            <SelectItem value="CRITICAL">Critical — service down</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
                                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">
                                        The ticket is routed to the right group and assigned to the
                                        least busy available agent when you create it.
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-11 font-semibold"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating ticket…
                                        </>
                                    ) : (
                                        'Create ticket'
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </div>
    );
}


