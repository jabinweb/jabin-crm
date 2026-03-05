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
    Phone,
    User,
    Plus,
    Search,
    ChevronRight,
    MoreVertical,
    Activity
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CustomersPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const [newCustomer, setNewCustomer] = useState({
        hospitalName: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        city: '',
    });

    const { data, isLoading } = useQuery({
        queryKey: ['customers', { search, page }],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                ...(search && { search }),
            });
            const response = await fetch(`/api/customers?${params}`);
            if (!response.ok) throw new Error('Failed to fetch customers');
            return response.json();
        },
    });

    const handleAddCustomer = async () => {
        if (!newCustomer.hospitalName || !newCustomer.contactPerson) {
            toast.error('Hospital Name and Contact Person are required');
            return;
        }

        setIsAdding(true);
        try {
            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCustomer),
            });

            if (!response.ok) throw new Error('Failed to add customer');

            toast.success('Customer added successfully');
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            setShowAddDialog(false);
            setNewCustomer({
                hospitalName: '',
                contactPerson: '',
                email: '',
                phone: '',
                address: '',
                city: '',
            });
        } catch (error) {
            toast.error('Failed to add customer');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="flex-1 space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Hospitals & Clinics</h2>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Hospital
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Hospital</DialogTitle>
                            <DialogDescription>
                                Enter the details of the new medical facility.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="hospitalName">Hospital Name</Label>
                                <Input
                                    id="hospitalName"
                                    value={newCustomer.hospitalName}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, hospitalName: e.target.value })}
                                    placeholder="e.g. City General Hospital"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="contactPerson">Primary Contact Person</Label>
                                <Input
                                    id="contactPerson"
                                    value={newCustomer.contactPerson}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })}
                                    placeholder="e.g. Dr. Smith"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={newCustomer.email}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={newCustomer.phone}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    value={newCustomer.city}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    value={newCustomer.address}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddCustomer} disabled={isAdding}>
                                {isAdding ? 'Adding...' : 'Add Customer'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Customer Directory</CardTitle>
                            <CardDescription>
                                Manage your medical equipment client base.
                            </CardDescription>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search hospitals..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8"
                            />
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
                                        <TableHead>Hospital Name</TableHead>
                                        <TableHead>Primary Contact</TableHead>
                                        <TableHead>City</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.customers?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                No customers found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data?.customers?.map((customer: any) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        <Building className="h-4 w-4 text-muted-foreground" />
                                                        <span>{customer.hospitalName}</span>
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
                                                        <span>{customer.city || 'N/A'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="ghost" size="sm">
                                                        <Link href={`/dashboard/customers/${customer.id}`}>
                                                            View Profile
                                                            <ChevronRight className="ml-2 h-4 w-4" />
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

                    {data?.pagination && data.pagination.pages > 1 && (
                        <div className="flex items-center justify-between mt-4">
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
