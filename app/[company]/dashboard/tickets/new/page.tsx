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
            toast.success('Ticket created successfully and assigned');
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
            <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Create Support Ticket</h2>
                    <p className="text-sm text-muted-foreground">Log a support request with the right category and routing.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left side: Main details */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border-t-4 border-t-primary shadow-none overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="text-lg flex items-center">
                                    <Ticket className="h-5 w-5 mr-2 text-primary" />
                                    Ticket Description
                                </CardTitle>
                                <CardDescription>Detailed information about the technical problem.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject / Issue Title</Label>
                                    <Input
                                        id="subject"
                                        placeholder="e.g. Monitor display flicker on patient monitor"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        className="text-lg focus-visible:ring-primary"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Detailed Description</Label>
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
                    <div className="space-y-6">
                        <Card className="shadow-none">
                            <CardHeader className="pb-3 bg-muted/20">
                                <CardTitle className="text-sm font-semibold flex items-center">
                                    <Building className="h-4 w-4 mr-2" />
                                    Facility & Context
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>Request category</Label>
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
                                        <SelectTrigger className="w-full">
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
                                    <Label>Client / site</Label>
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
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={isLoadingCustomers ? "Loading clients..." : "Select client"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customerData?.customers?.map((customer: any) => (
                                                <SelectItem key={customer.id} value={customer.id}>
                                                    {customer.organizationName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Project (optional)</Label>
                                    <Select
                                        value={formData.projectId || '__none__'}
                                        onValueChange={(val) =>
                                            setFormData({
                                                ...formData,
                                                projectId: val === '__none__' ? '' : val,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
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
                                    <Label>Equipment (Optional)</Label>
                                    <Select
                                        value={formData.equipmentId}
                                        onValueChange={(val) =>
                                            setFormData({ ...formData, equipmentId: val, serviceContractId: '' })
                                        }
                                        disabled={!formData.customerId || isLoadingEquipment}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={
                                                !formData.customerId ? "Select a client first" :
                                                    isLoadingEquipment ? "Loading equipment..." :
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
                                    <Label>Link to contract</Label>
                                    <Select
                                        value={formData.serviceContractId || 'none'}
                                        onValueChange={(val) =>
                                            setFormData({
                                                ...formData,
                                                serviceContractId: val === 'none' ? '' : val,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
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
                                        <p className="text-[10px] text-muted-foreground italic mt-1">
                                            No equipment records found for this client.
                                        </p>
                                    )}

                                {selectedType?.fields.map((field) => (
                                    <div key={field.id} className="space-y-2">
                                        <Label>{field.label}{field.required ? ' *' : ''}</Label>
                                        {field.type === 'textarea' ? (
                                            <Textarea
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
                                        <Label>
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
                                                <SelectTrigger>
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
                                                <SelectTrigger>
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
                                    Priority & Logic
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>Urgency / Priority</Label>
                                    <Select
                                        value={formData.priority}
                                        onValueChange={(val) => setFormData({ ...formData, priority: val })}
                                    >
                                        <SelectTrigger className="w-full border-l-4 border-l-yellow-500">
                                            <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LOW">Low - Maintenance/Query</SelectItem>
                                            <SelectItem value="MEDIUM">Medium - Normal Fault</SelectItem>
                                            <SelectItem value="HIGH">High - major business impact</SelectItem>
                                            <SelectItem value="CRITICAL">Critical - System Down</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-none border border-blue-100 flex items-start gap-2">
                                    <Loader2 className="h-4 w-4 text-blue-600 mt-0.5 animate-spin" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Round Robin System</p>
                                        <p className="text-[10px] text-blue-700 dark:text-blue-400">This ticket will be automatically assigned to the least busy technician upon submission.</p>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating Ticket...
                                        </>
                                    ) : (
                                        'Create Ticket'
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


