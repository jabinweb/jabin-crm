'use client';

import { useSession } from 'next-auth/react';

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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Package,
    Plus,
    RefreshCw,
    Search,
} from 'lucide-react';
import { humanizeEnum } from '@/lib/crm/humanize-enum';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { toast } from 'sonner';
import { FullTableSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';

const categories = [
    'HARDWARE',
    'SOFTWARE',
    'SERVICES',
    'CONSUMABLE',
    'OTHER',
];

export default function ProductsPage() {
    const queryClient = useQueryClient();
    const { workspaceFetch } = useWorkspacePaths();
    // The product write APIs are admin-only; everyone else browses the catalog
    const { data: session } = useSession();
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role ?? '');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>('all');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        category: 'HARDWARE',
        manufacturer: '',
        modelNumber: '',
    });

    const { data: products, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ['products', { category }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (category !== 'all') params.append('category', category);

            const response = await fetch(`/api/products?${params}`);
            if (!response.ok) throw new Error('Failed to fetch products');
            return response.json();
        },
    });

    const handleAddProduct = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (isAdding) return;
        if (!newProduct.name.trim() || !newProduct.category) {
            toast.error('Product name and category are required');
            return;
        }

        setIsAdding(true);
        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to add product');
            }

            toast.success(`${newProduct.name.trim()} added to the catalog`);
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setShowAddDialog(false);
            setNewProduct({
                name: '',
                description: '',
                category: 'HARDWARE',
                manufacturer: '',
                modelNumber: '',
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to add product');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteProduct = async (id: string, name: string) => {
        if (
            !(await confirmAction({
                title: `Delete product "${name}"?`,
                description: 'This cannot be undone.',
                confirmLabel: 'Delete',
                variant: 'destructive',
            }))
        )
            return;
        setDeletingId(id);
        try {
            const response = await workspaceFetch(`/api/products/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to delete product');
            }
            toast.success('Product deleted');
            queryClient.invalidateQueries({ queryKey: ['products'] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete product');
        } finally {
            setDeletingId(null);
        }
    };

    const filteredProducts = products?.filter((p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.modelNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p.manufacturer?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
                    <p className="text-sm text-muted-foreground">
                        Your catalog of products and services used in quotes, invoices and inventory.
                    </p>
                </div>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button className={isAdmin ? 'self-start sm:self-auto' : 'hidden'}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add product
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Add new product</DialogTitle>
                            <DialogDescription>
                                Define a new catalog item for inventory and tracking. Fields marked * are required.
                            </DialogDescription>
                        </DialogHeader>
                        <form id="add-product-form" onSubmit={handleAddProduct} className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Product name *</Label>
                                <Input
                                    id="name"
                                    required
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    placeholder="e.g. Pro workstation bundle"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Category *</Label>
                                    <Select
                                        value={newProduct.category}
                                        onValueChange={(val) => setNewProduct({ ...newProduct, category: val })}
                                    >
                                        <SelectTrigger id="category">
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((c) => (
                                                <SelectItem key={c} value={c}>{humanizeEnum(c)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="manufacturer">Manufacturer</Label>
                                    <Input
                                        id="manufacturer"
                                        value={newProduct.manufacturer}
                                        onChange={(e) => setNewProduct({ ...newProduct, manufacturer: e.target.value })}
                                        placeholder="e.g. Acme Industries"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="modelNumber">Model / part number</Label>
                                <Input
                                    id="modelNumber"
                                    value={newProduct.modelNumber}
                                    onChange={(e) => setNewProduct({ ...newProduct, modelNumber: e.target.value })}
                                    placeholder="e.g. SKU-10042"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description (optional)</Label>
                                <Input
                                    id="description"
                                    value={newProduct.description}
                                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                />
                            </div>
                        </form>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAddDialog(false)}
                                disabled={isAdding}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" form="add-product-form" disabled={isAdding}>
                                {isAdding ? 'Adding…' : 'Add product'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <CardTitle>Catalog</CardTitle>
                            <CardDescription>
                                Search by name, manufacturer or model number.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search
                                    className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    type="search"
                                    aria-label="Search products"
                                    placeholder="Search catalog..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All categories</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c} value={c}>{humanizeEnum(c)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <FullTableSkeleton columnCount={5} rowCount={5} />
                    ) : isError ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                            <p className="text-sm font-medium">We couldn&apos;t load the catalog.</p>
                            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
                            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                                <RefreshCw className={`mr-2 h-4 w-4${isFetching ? ' animate-spin' : ''}`} />
                                Try again
                            </Button>
                        </div>
                    ) : !filteredProducts?.length ? (
                        <EmptyState
                            icon={Package}
                            title={
                                search || category !== 'all'
                                    ? 'No matching products'
                                    : 'No products yet'
                            }
                            description={
                                search || category !== 'all'
                                    ? 'Try a different search or category filter.'
                                    : isAdmin
                                      ? 'Add your first product so it can be used on quotes and invoices.'
                                      : 'An admin needs to add products to the catalog.'
                            }
                            actionLabel={
                                search || category !== 'all' || !isAdmin ? undefined : 'Add product'
                            }
                            onAction={
                                search || category !== 'all' || !isAdmin
                                    ? undefined
                                    : () => setShowAddDialog(true)
                            }
                        />
                    ) : (
                        <>
                        <div className="divide-y rounded-none border md:hidden">
                            {filteredProducts?.map((p: any) => (
                                <div key={p.id} className="flex items-start gap-2 p-3">
                                    <DashboardLink
                                        href={`/dashboard/products/${p.id}`}
                                        className="min-w-0 flex-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="truncate font-medium">{p.name}</span>
                                        </div>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {[p.manufacturer, p.modelNumber].filter(Boolean).join(' · ') ||
                                                'No manufacturer or model'}
                                        </p>
                                        {p.category ? (
                                            <Badge variant="outline" className="mt-2 text-xs">
                                                {humanizeEnum(p.category)}
                                            </Badge>
                                        ) : null}
                                    </DashboardLink>
                                    <div className={isAdmin ? 'flex shrink-0 flex-col gap-1' : 'hidden'}>
                                        <Button variant="ghost" size="sm" className="h-10" asChild>
                                            <DashboardLink href={`/dashboard/products/${p.id}/edit`}>
                                                Edit
                                            </DashboardLink>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-10 text-destructive hover:text-destructive"
                                            disabled={deletingId === p.id}
                                            onClick={() => handleDeleteProduct(p.id, p.name)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden rounded-none border md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Manufacturer</TableHead>
                                        <TableHead>Model No.</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts?.map((p: any) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">
                                                <DashboardLink
                                                    href={`/dashboard/products/${p.id}`}
                                                    className="flex items-center space-x-2 hover:underline"
                                                >
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                    <span>{p.name}</span>
                                                </DashboardLink>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {humanizeEnum(p.category)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {p.manufacturer || '—'}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono text-muted-foreground">
                                                {p.modelNumber || '—'}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <DashboardLink href={`/dashboard/products/${p.id}`}>
                                                        View
                                                    </DashboardLink>
                                                </Button>
                                                {isAdmin && (
                                                    <>
                                                        <Button variant="ghost" size="sm" asChild>
                                                            <DashboardLink href={`/dashboard/products/${p.id}/edit`}>
                                                                Edit
                                                            </DashboardLink>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            disabled={deletingId === p.id}
                                                            onClick={() => handleDeleteProduct(p.id, p.name)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

