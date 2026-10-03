'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
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
    Loader2,
    Info
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/lib/api/canonical-routes';

function RequiredMark() {
    return (
        <span className="text-destructive" aria-hidden="true">
            *
        </span>
    );
}

export default function NewEquipmentPage() {
    const router = useRouter();
    const { path, workspaceFetch } = useWorkspacePaths();
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
            const response = await workspaceFetch('/api/customers?limit=100');
            if (!response.ok) throw new Error('Failed to fetch customers');
            return response.json();
        },
    });

    // 2. Fetch Products (Models)
    const { data: products, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products-list-mini'],
        queryFn: async () => {
            const response = await workspaceFetch('/api/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            return response.json();
        },
    });

    const warrantyBeforeInstall =
        !!formData.warrantyExpiry &&
        !!formData.installationDate &&
        formData.warrantyExpiry < formData.installationDate;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerId || !formData.productId || !formData.serialNumber.trim()) {
            toast.error('Choose a customer and product, and enter a serial number.');
            return;
        }
        if (warrantyBeforeInstall) {
            toast.error('Warranty expiry must be on or after the installation date.');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await workspaceFetch(API_ROUTES.inventoryInstallations, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(typeof body.error === 'string' ? body.error : 'Failed to register equipment');
            }

            toast.success('Equipment registered');
            queryClient.invalidateQueries({ queryKey: ['customer', formData.customerId] });
            router.push(path(`/dashboard/customers/${formData.customerId}`));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to register equipment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const customers = customerData?.customers ?? [];
    const productList = Array.isArray(products) ? products : [];

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex flex-col items-start gap-2">
                <Button variant="ghost" size="sm" className="-ml-3" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Register equipment</h1>
                    <p className="text-sm text-muted-foreground">
                        Record a unit installed at a customer site so it can be serviced and tracked.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center text-lg">
                            <Wrench className="h-5 w-5 mr-2 text-primary" />
                            Installation details
                        </CardTitle>
                        <CardDescription>Which unit was installed, where, and its warranty terms.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="eq-customer">
                                    Customer <RequiredMark />
                                </Label>
                                <Select
                                    value={formData.customerId}
                                    onValueChange={(val) => setFormData({ ...formData, customerId: val })}
                                >
                                    <SelectTrigger id="eq-customer" aria-required="true">
                                        <SelectValue placeholder={isLoadingCustomers ? 'Loading customers…' : 'Select customer'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((customer: any) => (
                                            <SelectItem key={customer.id} value={customer.id}>
                                                {customer.organizationName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {!isLoadingCustomers && customers.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        No customers yet.{' '}
                                        <Link
                                            href={path('/dashboard/customers/new')}
                                            className="text-primary underline underline-offset-2"
                                        >
                                            Add a customer
                                        </Link>{' '}
                                        first.
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="eq-product">
                                    Product / model <RequiredMark />
                                </Label>
                                <Select
                                    value={formData.productId}
                                    onValueChange={(val) => setFormData({ ...formData, productId: val })}
                                >
                                    <SelectTrigger id="eq-product" aria-required="true">
                                        <SelectValue placeholder={isLoadingProducts ? 'Loading products…' : 'Select product'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {productList.map((product: any) => (
                                            <SelectItem key={product.id} value={product.id}>
                                                {product.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {!isLoadingProducts && productList.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        No products yet.{' '}
                                        <Link
                                            href={path('/dashboard/products')}
                                            className="text-primary underline underline-offset-2"
                                        >
                                            Add a product
                                        </Link>{' '}
                                        to register units of it.
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="eq-serial">
                                    Serial number <RequiredMark />
                                </Label>
                                <Input
                                    id="eq-serial"
                                    placeholder="e.g. SN-2041-0098"
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    autoComplete="off"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="eq-installed">
                                        Installation date <RequiredMark />
                                    </Label>
                                    <Input
                                        id="eq-installed"
                                        type="date"
                                        value={formData.installationDate}
                                        onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="eq-warranty">
                                        Warranty expiry <RequiredMark />
                                    </Label>
                                    <Input
                                        id="eq-warranty"
                                        type="date"
                                        min={formData.installationDate || undefined}
                                        value={formData.warrantyExpiry}
                                        onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                                        aria-invalid={warrantyBeforeInstall || undefined}
                                        required
                                    />
                                    {warrantyBeforeInstall ? (
                                        <p className="text-xs text-destructive">
                                            Must be on or after the installation date.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                                Once registered, technicians can file service reports against this unit and its
                                full service history is kept on the customer record.
                            </p>
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Registering…
                                </>
                            ) : (
                                'Register equipment'
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
