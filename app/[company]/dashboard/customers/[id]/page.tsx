'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  MapPin,
  Phone,
  Mail,
  Plus,
  Download,
  Ticket,
  ChevronLeft,
  User,
  Pencil,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { ServiceLinkCard } from '@/components/service-request/service-link-card';
import { DetailSkeleton } from '@/components/loading';
import { CurrencySelect } from '@/components/ui/currency-select';
import { cn } from '@/lib/utils';
import { CustomerPeopleTab } from '@/components/customers/customer-people-tab';
import { CustomerDepartmentsTab } from '@/components/customers/customer-departments-tab';
import { CustomerVisitsTab } from '@/components/customers/customer-visits-tab';
import { EmailComposeDialog } from '@/components/email/email-compose-dialog';

const CUSTOMER_TABS = [
  { value: 'people', label: 'People' },
  { value: 'departments', label: 'Departments' },
  { value: 'visits', label: 'Visits' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'timeline', label: 'Activity' },
] as const;

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const [activeTab, setActiveTab] = useState('people');

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', slug, id],
    queryFn: async () => {
      const response = await workspaceFetch(`/api/customers/${id}`);
      if (!response.ok) throw new Error('Failed to fetch customer');
      return response.json();
    },
  });

  const [isInviting, setIsInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    temporaryPassword?: string;
    signInUrl?: string;
  } | null>(null);
  const [billingCurrencyDraft, setBillingCurrencyDraft] = useState<string | null>(null);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    organizationName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    industry: '',
    notes: '',
  });
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTarget, setComposeTarget] = useState<{ to: string; subject: string }>({
    to: '',
    subject: '',
  });

  const billingCurrencyValue =
    billingCurrencyDraft ?? customer?.billingCurrency ?? '';

  const openEdit = () => {
    if (!customer) return;
    setEditForm({
      organizationName: customer.organizationName || '',
      contactPerson: customer.contactPerson || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      industry: customer.industry || '',
      notes: customer.notes || '',
    });
    setEditOpen(true);
  };

  const openEmail = (to: string, name?: string) => {
    if (!to) {
      toast.error('No email address');
      return;
    }
    setComposeTarget({
      to,
      subject: `Regarding ${customer?.organizationName || 'your account'}${
        name ? ` — ${name}` : ''
      }`,
    });
    setComposeOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.organizationName.trim() || !editForm.contactPerson.trim()) {
      toast.error('Organization and contact person are required');
      return;
    }
    setSavingEdit(true);
    try {
      const response = await workspaceFetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: editForm.organizationName.trim(),
          contactPerson: editForm.contactPerson.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          city: editForm.city.trim() || null,
          state: editForm.state.trim() || null,
          industry: editForm.industry.trim() || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update');
      }
      toast.success('Client updated');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customer', slug, id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update client');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveBillingCurrency = async () => {
    setSavingCurrency(true);
    try {
      const response = await workspaceFetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingCurrency: billingCurrencyValue || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to update currency');
      toast.success('Billing currency updated');
      setBillingCurrencyDraft(null);
      queryClient.invalidateQueries({ queryKey: ['customer', slug, id] });
    } catch {
      toast.error('Could not update billing currency');
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleInviteToPortal = async () => {
    setIsInviting(true);
    try {
      const response = await workspaceFetch(`/api/customers/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customer.email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Invite failed');
      setInviteResult({
        temporaryPassword: body.temporaryPassword,
        signInUrl: body.signInUrl,
      });
      toast.success(body.alreadyInvited ? 'Portal user already exists' : 'Portal invite created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to invite customer');
    } finally {
      setIsInviting(false);
    }
  };

  const handleExportHistory = async () => {
    toast.loading('Preparing history report...', { id: 'export' });
    try {
      const response = await workspaceFetch(`/api/customers/${id}/history?format=csv`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `client_history_${customer.organizationName.replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('History exported', { id: 'export' });
    } catch {
      toast.error('Failed to export history', { id: 'export' });
    }
  };

  const handleExportFull = () => {
    if (!customer) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      customer: {
        id: customer.id,
        organizationName: customer.organizationName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        industry: customer.industry,
        notes: customer.notes,
        billingCurrency: customer.billingCurrency,
      },
      contacts: customer.contacts || [],
      departments: customer.departments || [],
      visits: customer.visits || [],
      equipment: customer.equipmentInstallations || [],
      tickets: customer.supportTickets || [],
      activities: customer.activities || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client_${String(customer.organizationName || 'export')
      .replace(/\s+/g, '_')
      .replace(/[^\w.-]/g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Client data exported');
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <h3 className="text-xl font-semibold">Customer not found</h3>
        <Button asChild variant="outline" className="mt-4">
          <Link href={path('/dashboard/customers')}>Back to Directory</Link>
        </Button>
      </div>
    );
  }

  const customerId = String(id);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">
              {customer.organizationName}
            </h2>
            <Badge variant="outline">{customer.city || 'No city'}</Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-start gap-1.5">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>{customer.address || 'No address'}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" className="h-11" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={handleInviteToPortal}
            disabled={isInviting}
          >
            <User className="mr-2 h-4 w-4" />
            {isInviting ? '…' : 'Invite'}
          </Button>
          <Button variant="outline" className="h-11" onClick={handleExportFull}>
            <Download className="mr-2 h-4 w-4" />
            Export data
          </Button>
          <Button variant="outline" className="h-11" onClick={handleExportHistory}>
            <Download className="mr-2 h-4 w-4" />
            History CSV
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <Link href={path('/dashboard/settings/migration')}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button asChild className="h-11">
            <Link href={path(`/dashboard/tickets/new?customerId=${id}`)}>
              <Ticket className="mr-2 h-4 w-4" />
              New ticket
            </Link>
          </Button>
        </div>
      </div>

      {inviteResult?.temporaryPassword ? (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-base">Portal credentials</CardTitle>
            <CardDescription>
              Share these with {customer.contactPerson}. They should change their password after
              first sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Sign-in URL:</span>{' '}
              <a href={inviteResult.signInUrl} className="text-primary underline">
                {inviteResult.signInUrl}
              </a>
            </p>
            <p>
              <span className="font-medium">Temporary password:</span>{' '}
              <code className="rounded bg-white px-2 py-0.5">{inviteResult.temporaryPassword}</code>
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ServiceLinkCard
        scope="customer"
        id={customerId}
        title="QR / one-click service request"
        description="Share with this hospital or clinic so they can raise tickets without WhatsApp or a portal login."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 order-1 lg:order-2 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="sticky top-0 z-10 -mx-1 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-0 pt-1">
              <TabsList className="h-auto w-full justify-start gap-0 rounded-none bg-transparent p-0">
                {CUSTOMER_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'relative shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none',
                      'hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none'
                    )}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="people" className="mt-0 space-y-4">
              <CustomerPeopleTab
                customerId={customerId}
                slug={slug}
                contacts={customer.contacts || []}
                departments={customer.departments || []}
                workspaceFetch={workspaceFetch}
                onEmail={(email, name) => openEmail(email, name)}
              />
            </TabsContent>

            <TabsContent value="departments" className="mt-0 space-y-4">
              <CustomerDepartmentsTab
                customerId={customerId}
                slug={slug}
                departments={customer.departments || []}
                workspaceFetch={workspaceFetch}
              />
            </TabsContent>

            <TabsContent value="visits" className="mt-0 space-y-4">
              <CustomerVisitsTab
                customerId={customerId}
                slug={slug}
                visits={customer.visits || []}
                contacts={customer.contacts || []}
                departments={customer.departments || []}
                workspaceFetch={workspaceFetch}
              />
            </TabsContent>

            <TabsContent value="equipment" className="mt-0 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">Equipment</h3>
                  <p className="text-sm text-muted-foreground">Installed assets</p>
                </div>
                <Button asChild className="h-11 shrink-0">
                  <Link href={path(`/dashboard/inventory/new?customerId=${id}`)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add
                  </Link>
                </Button>
              </div>
              {!customer.equipmentInstallations?.length ? (
                <p className="text-sm text-muted-foreground italic py-6 text-center border border-dashed rounded-2xl">
                  No equipment yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {customer.equipmentInstallations.map((eq: any) => (
                    <li key={eq.id} className="rounded-2xl border p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{eq.product?.name || 'Unknown'}</p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {eq.serialNumber || 'No S/N'}
                          </p>
                        </div>
                        <Badge variant={eq.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {eq.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Installed {new Date(eq.installationDate).toLocaleDateString()}
                        {eq.warrantyExpiry
                          ? ` · Warranty ${new Date(eq.warrantyExpiry).toLocaleDateString()}`
                          : ''}
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="h-10 w-full">
                            QR link
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Equipment service QR</DialogTitle>
                            <DialogDescription>
                              Stick this QR on the machine for unit-scoped tickets.
                            </DialogDescription>
                          </DialogHeader>
                          <ServiceLinkCard
                            scope="equipment"
                            id={eq.id}
                            title={eq.product?.name || 'Equipment'}
                            description={
                              eq.serialNumber
                                ? `S/N ${eq.serialNumber}`
                                : 'Equipment-scoped request link'
                            }
                          />
                        </DialogContent>
                      </Dialog>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="tickets" className="mt-0 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Tickets</h3>
                <p className="text-sm text-muted-foreground">Service / break-fix history</p>
              </div>
              {!customer.supportTickets?.length ? (
                <p className="text-sm text-muted-foreground italic py-6 text-center border border-dashed rounded-2xl">
                  No tickets yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {customer.supportTickets.map((ticket: any) => (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        className="w-full rounded-2xl border p-3.5 text-left active:bg-muted/40"
                        onClick={() => router.push(path(`/dashboard/tickets/${ticket.id}`))}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-snug">{ticket.subject}</p>
                          <Badge
                            className={cn(
                              'shrink-0',
                              ticket.status === 'RESOLVED'
                                ? 'bg-green-500 hover:bg-green-600'
                                : ticket.status === 'OPEN'
                                  ? 'bg-red-500 hover:bg-red-600'
                                  : 'bg-blue-500'
                            )}
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ticket.priority} · {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity</CardTitle>
                  <CardDescription>Recent updates for this client.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                    {!customer.activities?.length ? (
                      <p className="text-sm text-muted-foreground italic pl-8">No activity yet.</p>
                    ) : (
                      customer.activities.map((activity: any) => (
                        <div key={activity.id} className="relative pl-8">
                          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {String(activity.eventType).replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="lg:col-span-1 order-2 lg:order-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Primary contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">{customer.contactPerson}</p>
              </div>
              {customer.phone ? (
                <Button asChild variant="outline" className="h-11 w-full justify-start">
                  <a href={`tel:${customer.phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    {customer.phone}
                  </a>
                </Button>
              ) : null}
              {customer.email ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-start"
                  onClick={() => openEmail(customer.email)}
                >
                  <Mail className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">At a glance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ['People', customer._count?.contacts ?? customer.contacts?.length ?? 0],
                  ['Departments', customer._count?.departments ?? customer.departments?.length ?? 0],
                  ['Visits', customer._count?.visits ?? customer.visits?.length ?? 0],
                  ['Equipment', customer.equipmentInstallations?.length || 0],
                  [
                    'Open tickets',
                    customer.supportTickets?.filter(
                      (t: { status: string }) =>
                        t.status !== 'RESOLVED' && t.status !== 'CLOSED'
                    ).length || 0,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Billing currency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CurrencySelect
                id="customer-billing-currency"
                label=""
                allowEmpty
                emptyLabel="Company default"
                value={billingCurrencyValue}
                onValueChange={(value) => setBillingCurrencyDraft(String(value))}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full"
                disabled={savingCurrency || billingCurrencyDraft === null}
                onClick={handleSaveBillingCurrency}
              >
                {savingCurrency ? 'Saving…' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
            <DialogDescription>Update organization and primary contact details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Organization *</Label>
              <Input
                value={editForm.organizationName}
                onChange={(e) =>
                  setEditForm({ ...editForm, organizationName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Contact person *</Label>
              <Input
                value={editForm.contactPerson}
                onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>State</Label>
                <Input
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Industry</Label>
              <Input
                value={editForm.industry}
                onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={composeTarget}
        leadData={{
          companyName: customer.organizationName,
          contactName: customer.contactPerson,
          email: composeTarget.to || customer.email || undefined,
          phone: customer.phone || undefined,
          city: customer.city || undefined,
          state: customer.state || undefined,
          industry: customer.industry || undefined,
        }}
      />
    </div>
  );
}
