'use client';

import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    ChevronLeft,
    Wrench,
    Building,
    Calendar,
    Hash,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function NewEquipmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const initialCustomerId = searchParams.get('customerId') || '';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        customerId: initialCustomerId,
        productId: '',
        serialNumber: '',
        installationDate: new Date().toISOString().split('T')[0],
        warrantyExpiry: '',
    });

    // 1. Fetch Customers
    const { data: customerData, isLoading: isLoadingCustomers } = useQuery({
        queryKey: ['customers-list-mini'],
        queryFn: async () => {
            const response = await fetch('/api/customers?limit=100');
            if (!response.ok) throw new Error('Failed to fetch customers');
            return response.json();
        },
    });

    // 2. Fetch Products (Models)
    const { data: products, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products-list-mini'],
        queryFn: async () => {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            return response.json();
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.productId || !formData.serialNumber) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/equipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('Failed to register equipment');

            toast.success('Equipment registered successfully');
            queryClient.invalidateQueries({ queryKey: ['customer', formData.customerId] });
            router.push(`/dashboard/customers/${formData.customerId}`);
        } catch (error) {
            toast.error('Failed to register equipment');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 space-y-6 max-w-2xl mx-auto py-6">
            <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Register New Equipment</h2>
                    <p className="text-sm text-muted-foreground">Add a medical device installation to a hospital record.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card className="shadow-xl border-t-4 border-t-orange-500">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Wrench className="h-5 w-5 mr-2 text-orange-500" />
                            Installation Record
                        </CardTitle>
                        <CardDescription>Enter the hardware details and warranty terms.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-4">
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    <Building className="h-3.5 w-3.5 text-muted-foreground" />
                                    Hospital Location
                                </Label>
                                <Select
                                    value={formData.customerId}
                                    onValueChange={(val) => setFormData({ ...formData, customerId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingCustomers ? "Loading..." : "Select hospital"} />
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

                            <div className="grid gap-2">
                                <Label>Equipment Model / Product</Label>
                                <Select
                                    value={formData.productId}
                                    onValueChange={(val) => setFormData({ ...formData, productId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoadingProducts ? "Loading models..." : "Select product model"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products?.map((product: any) => (
                                            <SelectItem key={product.id} value={product.id}>
                                                {product.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                    Serial Number
                                </Label>
                                <Input
                                    placeholder="SN-XXXX-XXXX"
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        Installation Date
                                    </Label>
                                    <Input
                                        type="date"
                                        value={formData.installationDate}
                                        onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        Warranty Expiry
                                    </Label>
                                    <Input
                                        type="date"
                                        value={formData.warrantyExpiry}
                                        onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-100 flex items-start gap-3">
                            <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-full mt-1">
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase">Service Tracking Enabled</p>
                                <p className="text-[11px] text-orange-700 dark:text-orange-400">Registering this equipment allows technicians to file service reports and track technical history specific to this unit.</p>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Registering...
                                </>
                            ) : (
                                'Register Equipment'
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}

