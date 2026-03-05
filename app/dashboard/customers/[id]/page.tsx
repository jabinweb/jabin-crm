'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Building,
    MapPin,
    Phone,
    Mail,
    Plus,
    Download,
    History,
    Wrench,
    Ticket,
    ChevronLeft,
    Calendar,
    User,
    Activity as ActivityIcon
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

export default function CustomerDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('overview');

    const { data: customer, isLoading } = useQuery({
        queryKey: ['customer', id],
        queryFn: async () => {
            const response = await fetch(`/api/customers/${id}`);
            if (!response.ok) throw new Error('Failed to fetch customer');
            return response.json();
        },
    });

    const [showContactDialog, setShowContactDialog] = useState(false);
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [newContact, setNewContact] = useState({
        name: '',
        role: '',
        email: '',
        phone: '',
    });

    const handleAddContact = async () => {
        if (!newContact.name) {
            toast.error('Contact name is required');
            return;
        }
        setIsAddingContact(true);
        try {
            const response = await fetch(`/api/customers/${id}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newContact),
            });
            if (!response.ok) throw new Error('Failed to add contact');
            toast.success('Contact added successfully');
            queryClient.invalidateQueries({ queryKey: ['customer', id] });
            setShowContactDialog(false);
            setNewContact({ name: '', role: '', email: '', phone: '' });
        } catch (error) {
            toast.error('Failed to add contact');
        } finally {
            setIsAddingContact(false);
        }
    };

    const handleExportHistory = async () => {
        toast.loading('Preparing history report...', { id: 'export' });
        try {
            const response = await fetch(`/api/customers/${id}/history?format=csv`);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hospital_history_${customer.hospitalName.replace(/\s+/g, '_')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('History exported successfully', { id: 'export' });
        } catch (error) {
            toast.error('Failed to export history', { id: 'export' });
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-20">
                <h3 className="text-xl font-semibold">Customer not found</h3>
                <Button asChild variant="outline" className="mt-4">
                    <Link href="/dashboard/customers">Back to Directory</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <h2 className="text-3xl font-bold tracking-tight">{customer.hospitalName}</h2>
                        <Badge variant="outline">{customer.city || 'Location Pending'}</Badge>
                    </div>
                    <p className="text-muted-foreground flex items-center">
                        <MapPin className="h-4 w-4 mr-1 text-primary" />
                        {customer.address || 'No address provided'}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={handleExportHistory}>
                        <Download className="mr-2 h-4 w-4" />
                        Export History
                    </Button>
                    <Button asChild>
                        <Link href={`/dashboard/tickets/new?customerId=${id}`}>
                            <Ticket className="mr-2 h-4 w-4" />
                            New Ticket
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar Info */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Contact Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">{customer.contactPerson}</p>
                                    <p className="text-xs text-muted-foreground">Primary Contact</p>
                                </div>
                            </div>
                            {customer.email && (
                                <div className="flex items-start space-x-3">
                                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <p className="text-sm break-all">{customer.email}</p>
                                </div>
                            )}
                            {customer.phone && (
                                <div className="flex items-start space-x-3">
                                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <p className="text-sm">{customer.phone}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between items-center text-muted-foreground">
                                <span>Equipment</span>
                                <span className="font-semibold text-foreground">{customer.equipmentInstallations?.length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-muted-foreground">
                                <span>Open Tickets</span>
                                <span className="font-semibold text-foreground">
                                    {customer.supportTickets?.filter((t: any) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length || 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-muted-foreground">
                                <span>Total Tickets</span>
                                <span className="font-semibold text-foreground">{customer.supportTickets?.length || 0}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Tabs Area */}
                <div className="lg:col-span-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="bg-muted/50 p-1">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="equipment">Equipment</TabsTrigger>
                            <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
                            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Additional Contacts</CardTitle>
                                        <CardDescription>Emergency contacts and departmental leads.</CardDescription>
                                    </div>
                                    <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Contact
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Add New Contact</DialogTitle>
                                                <DialogDescription>Add a person associated with this facility.</DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="name">Full Name</Label>
                                                    <Input id="name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="e.g. John Doe" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="role">Role / Designation</Label>
                                                    <Input id="role" value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} placeholder="e.g. Biomedical Engineer" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="c-email">Email</Label>
                                                        <Input id="c-email" type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="c-phone">Phone</Label>
                                                        <Input id="c-phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleAddContact} disabled={isAddingContact}>
                                                    {isAddingContact ? 'Adding...' : 'Save Contact'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent>
                                    {!customer.contacts || customer.contacts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-4 italic">No secondary contacts added.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {customer.contacts.map((contact: any) => (
                                                <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                    <div>
                                                        <p className="font-medium">{contact.name}</p>
                                                        <p className="text-xs text-muted-foreground">{contact.role} | {contact.email}</p>
                                                    </div>
                                                    <p className="text-sm">{contact.phone}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="equipment" className="space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Installed Equipment</CardTitle>
                                        <CardDescription>Listing of medical devices installed at this facility.</CardDescription>
                                    </div>
                                    <Button asChild size="sm">
                                        <Link href={`/dashboard/equipment/new?customerId=${id}`}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Equipment
                                        </Link>
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Model</TableHead>
                                                <TableHead>Serial Number</TableHead>
                                                <TableHead>Install Date</TableHead>
                                                <TableHead>Warranty</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {customer.equipmentInstallations?.map((eq: any) => (
                                                <TableRow key={eq.id}>
                                                    <TableCell className="font-medium">{eq.product?.name || 'Unknown'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{eq.serialNumber}</TableCell>
                                                    <TableCell>{new Date(eq.installationDate).toLocaleDateString()}</TableCell>
                                                    <TableCell>{new Date(eq.warrantyExpiry).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={eq.status === 'ACTIVE' ? 'default' : 'secondary'}>{eq.status}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="tickets" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Support History</CardTitle>
                                    <CardDescription>Track all service requests and technical issues.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {customer.supportTickets?.map((ticket: any) => (
                                            <div key={ticket.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                                                onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">{ticket.subject}</p>
                                                        <Badge variant={ticket.priority === 'CRITICAL' ? 'destructive' : 'outline'}>{ticket.priority}</Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">ID: {ticket.id} • Created on {new Date(ticket.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                <Badge className={cn(
                                                    ticket.status === 'RESOLVED' ? "bg-green-500 hover:bg-green-600" :
                                                        ticket.status === 'OPEN' ? "bg-red-500 hover:bg-red-600" : "bg-blue-500"
                                                )}>
                                                    {ticket.status}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="timeline" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Timeline</CardTitle>
                                    <CardDescription>Full history of interactions and installations.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                                        {customer.activities?.map((activity: any) => (
                                            <div key={activity.id} className="relative pl-8">
                                                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">{activity.eventType.replace(/_/g, ' ')}</p>
                                                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

// Helper for conditional classNames (assuming lib/utils is standard Shadcn)
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
