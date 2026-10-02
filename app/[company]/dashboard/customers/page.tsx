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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Building,
    MapPin,
    User,
    Plus,
    RefreshCw,
    Search,
    ChevronRight,
    Users,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { EmptyState } from '@/components/ui/empty-state';
import { FullTableSkeleton } from '@/components/loading';
import { CurrencySelect } from '@/components/ui/currency-select';
import { useWorkspaceTerminology } from '@/hooks/use-workspace-config';

const EMPTY_CUSTOMER = {
    organizationName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    billingCurrency: '',
};

export default function CustomersPage() {
    const queryClient = useQueryClient();
    const { slug, path, workspaceFetch } = useWorkspacePaths();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
    const terminology = useWorkspaceTerminology();
    const pluralLabel = terminology?.customers ?? 'Clients';
    const singularLabel = (terminology?.customer ?? 'Client').toLowerCase();

    const { data, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ['customers', slug, { search, page }],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                ...(search && { search }),
            });
            const response = await workspaceFetch(`/api/customers?${params}`);
            if (!response.ok) throw new Error('Failed to fetch customers');
            return response.json();
        },
    });

    const handleAddCustomer = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (isAdding) return;
        if (!newCustomer.organizationName.trim() || !newCustomer.contactPerson.trim()) {
            toast.error('Organization name and primary contact are required');
            return;
        }

        setIsAdding(true);
        try {
            const response = await workspaceFetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCustomer),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Failed to add ${singularLabel}`);
            }

            toast.success(`${newCustomer.organizationName.trim()} added`);
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            setShowAddDialog(false);
            setNewCustomer(EMPTY_CUSTOMER);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to add ${singularLabel}`);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight">{pluralLabel}</h1>
                    <p className="text-sm text-muted-foreground">
                        The organizations and accounts you sell to and support.
                    </p>
                </div>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button className="self-start sm:self-auto">
                            <Plus className="mr-2 h-4 w-4" />
                            Add {singularLabel}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add {singularLabel}</DialogTitle>
                            <DialogDescription>
                                Enter the organization or account you work with. Fields marked * are required.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddCustomer} className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="organizationName">Organization name *</Label>
                                <Input
                                    id="organizationName"
                                    required
                                    autoComplete="organization"
                                    value={newCustomer.organizationName}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, organizationName: e.target.value })}
                                    placeholder="e.g. Acme Corporation"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="contactPerson">Primary contact *</Label>
                                <Input
                                    id="contactPerson"
                                    required
                                    autoComplete="name"
                                    value={newCustomer.contactPerson}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })}
                                    placeholder="e.g. Jane Smith"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        value={newCustomer.email}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        autoComplete="tel"
                                        value={newCustomer.phone}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    autoComplete="address-level2"
                                    value={newCustomer.city}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    autoComplete="street-address"
                                    value={newCustomer.address}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                />
                            </div>
                            <CurrencySelect
                                id="billingCurrency"
                                label="Billing currency"
                                allowEmpty
                                emptyLabel="Use company default"
                                value={newCustomer.billingCurrency}
                                onValueChange={(value) =>
                                    setNewCustomer({ ...newCustomer, billingCurrency: String(value) })
                                }
                                description="Quotes and invoices for this client will default to this currency."
                            />
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowAddDialog(false)}
                                    disabled={isAdding}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isAdding}>
                                    {isAdding ? 'Adding…' : `Add ${singularLabel}`}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="min-w-0">
                            <CardTitle>Directory</CardTitle>
                            <CardDescription>
                                Search and open a profile to see contacts, tickets and billing.
                            </CardDescription>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search
                                className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                type="search"
                                aria-label={`Search ${pluralLabel.toLowerCase()}`}
                                placeholder="Search by name, contact or city..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <FullTableSkeleton columnCount={4} rowCount={5} />
                    ) : isError ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                            <p className="text-sm font-medium">We couldn&apos;t load this list.</p>
                            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
                            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                                <RefreshCw className={`mr-2 h-4 w-4${isFetching ? ' animate-spin' : ''}`} />
                                Try again
                            </Button>
                        </div>
                    ) : !data?.customers?.length ? (
                        <EmptyState
                            icon={Users}
                            title={search ? 'No matches' : `No ${pluralLabel.toLowerCase()} yet`}
                            description={
                                search
                                    ? 'Try a different search term.'
                                    : `Add your first ${singularLabel} to start sending quotes, invoices and logging tickets.`
                            }
                            actionLabel={search ? undefined : `Add ${singularLabel}`}
                            onAction={search ? undefined : () => setShowAddDialog(true)}
                        />
                    ) : (
                        <>
                        <div className="divide-y rounded-md border md:hidden">
                            {data.customers.map((customer: any) => (
                                <Link
                                    key={customer.id}
                                    href={path(`/dashboard/customers/${customer.id}`)}
                                    className="flex items-center gap-3 px-3 py-3 active:bg-muted/40"
                                >
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className="truncate font-medium">{customer.organizationName}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {[customer.contactPerson, customer.city].filter(Boolean).join(' · ') || 'No contact details'}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                </Link>
                            ))}
                        </div>
                        <div className="hidden rounded-md border md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Organization</TableHead>
                                        <TableHead>Primary Contact</TableHead>
                                        <TableHead>City</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.customers.map((customer: any) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        <Building className="h-4 w-4 text-muted-foreground" />
                                                        <span>{customer.organizationName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2 text-sm">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <span>{customer.contactPerson}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                                        <MapPin className="h-4 w-4" />
                                                        <span>{customer.city || '—'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="ghost" size="sm">
                                                        <Link href={path(`/dashboard/customers/${customer.id}`)}>
                                                            View profile
                                                            <ChevronRight className="ml-2 h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>
                        </>
                    )}

                    {!isError && data?.pagination && data.pagination.pages > 1 && (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-muted-foreground">
                                Page {data.pagination.page} of {data.pagination.pages}
                            </p>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page <= 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page + 1)}
                                    disabled={page >= data.pagination.pages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

