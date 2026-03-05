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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Package,
    Plus,
    Search,
    Filter,
    Stethoscope,
    ShieldCheck,
    FileText
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const categories = [
    'DIAGNOSTIC',
    'IMAGING',
    'LABORATORY',
    'SURGICAL',
    'CONSUMABLE',
];

export default function ProductsPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>('all');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        category: 'DIAGNOSTIC',
        manufacturer: '',
        modelNumber: '',
    });

    const { data: products, isLoading } = useQuery({
        queryKey: ['products', { category }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (category !== 'all') params.append('category', category);

            const response = await fetch(`/api/products?${params}`);
            if (!response.ok) throw new Error('Failed to fetch products');
            return response.json();
        },
    });

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.category) {
            toast.error('Product Name and Category are required');
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
                const err = await response.json();
                throw new Error(err.error || 'Failed to add product');
            }

            toast.success('Product added successfully');
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setShowAddDialog(false);
            setNewProduct({
                name: '',
                description: '',
                category: 'DIAGNOSTIC',
                manufacturer: '',
                modelNumber: '',
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to add product');
        } finally {
            setIsAdding(false);
        }
    };

    const filteredProducts = products?.filter((p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.modelNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p.manufacturer?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex-1 space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Product Catalog</h2>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Add New Medical Product</DialogTitle>
                            <DialogDescription>
                                Define a new item for the inventory and equipment tracking.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Product Name</Label>
                                <Input
                                    id="name"
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    placeholder="e.g. Philips Lumify Ultra"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select
                                        value={newProduct.category}
                                        onValueChange={(val) => setNewProduct({ ...newProduct, category: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((c) => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
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
                                        placeholder="e.g. Philips"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="modelNumber">Model / Part Number</Label>
                                <Input
                                    id="modelNumber"
                                    value={newProduct.modelNumber}
                                    onChange={(e) => setNewProduct({ ...newProduct, modelNumber: e.target.value })}
                                    placeholder="e.g. S4-1 Broadband"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Input
                                    id="description"
                                    value={newProduct.description}
                                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddProduct} disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Register Product'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Inventory List</CardTitle>
                            <CardDescription>
                                Browse and filter medical hardware and consumables.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search catalog..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product Name</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Manufacturer</TableHead>
                                        <TableHead>Model No.</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No products found match your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProducts?.map((p: any) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        <Stethoscope className="h-4 w-4 text-blue-500" />
                                                        <span>{p.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {p.category}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {p.manufacturer || 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-sm font-mono text-muted-foreground">
                                                    {p.modelNumber || 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/dashboard/products/${p.id}`}>
                                                            <FileText className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
