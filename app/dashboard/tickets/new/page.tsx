'use client';

import { useState, useMemo } from 'react';
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

export default function NewTicketPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const initialCustomerId = searchParams.get('customerId') || '';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        customerId: initialCustomerId,
        equipmentId: '',
        subject: '',
        description: '',
        priority: 'MEDIUM',
    });

    // 1. Fetch Customers for and initialization
    const { data: customerData, isLoading: isLoadingCustomers } = useQuery({
        queryKey: ['customers-list'],
        queryFn: async () => {
            const response = await fetch('/api/customers?limit=100');
            if (!response.ok) throw new Error('Failed to fetch customers');
            return response.json();
        },
    });

    // 2. Fetch specific customer to get their equipment if selected
    const { data: selectedCustomer, isLoading: isLoadingEquipment } = useQuery({
        queryKey: ['customer-equipment', formData.customerId],
        queryFn: async () => {
            if (!formData.customerId) return null;
            const response = await fetch(`/api/customers/${formData.customerId}`);
            if (!response.ok) throw new Error('Failed to fetch customer equipment');
            return response.json();
        },
        enabled: !!formData.customerId,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.subject || !formData.description) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('Failed to create ticket');

            const ticket = await response.json();
            toast.success('Ticket created successfully and assigned');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            router.push(`/dashboard/tickets/${ticket.id}`);
        } catch (error) {
            toast.error('Failed to create ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 space-y-6 max-w-4xl mx-auto py-6">
            <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Create Support Ticket</h2>
                    <p className="text-sm text-muted-foreground">Log a new technical issue or service request.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left side: Main details */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border-t-4 border-t-primary shadow-lg overflow-hidden">
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
                        <Card className="shadow-md">
                            <CardHeader className="pb-3 bg-muted/20">
                                <CardTitle className="text-sm font-semibold flex items-center">
                                    <Building className="h-4 w-4 mr-2" />
                                    Facility & Context
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>Hospital / Facility</Label>
                                    <Select
                                        value={formData.customerId}
                                        onValueChange={(val) => setFormData({ ...formData, customerId: val, equipmentId: '' })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={isLoadingCustomers ? "Loading facilities..." : "Select hospital"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customerData?.customers?.map((customer: any) => (
                                                <SelectItem key={customer.id} value={customer.id}>
                                                    {customer.hospitalName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Equipment (Optional)</Label>
                                    <Select
                                        value={formData.equipmentId}
                                        onValueChange={(val) => setFormData({ ...formData, equipmentId: val })}
                                        disabled={!formData.customerId || isLoadingEquipment}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={
                                                !formData.customerId ? "Select hospital first" :
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
                                    {formData.customerId && !isLoadingEquipment && selectedCustomer?.equipmentInstallations?.length === 0 && (
                                        <p className="text-[10px] text-muted-foreground italic mt-1">
                                            No equipment records found for this hospital.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-md">
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
                                            <SelectItem value="HIGH">High - Clinical Impact</SelectItem>
                                            <SelectItem value="CRITICAL">Critical - System Down</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 flex items-start gap-2">
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

