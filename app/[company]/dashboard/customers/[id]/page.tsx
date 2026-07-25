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
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

  const billingCurrencyValue =
    billingCurrencyDraft ?? customer?.billingCurrency ?? '';

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
      toast.success('History exported successfully', { id: 'export' });
    } catch {
      toast.error('Failed to export history', { id: 'export' });
    }
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center w-full sm:w-auto">
          <Button
            variant="outline"
            className="h-11"
            onClick={handleInviteToPortal}
            disabled={isInviting}
          >
            <User className="mr-2 h-4 w-4" />
            {isInviting ? '…' : 'Invite'}
          </Button>
          <Button variant="outline" className="h-11" onClick={handleExportHistory}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button asChild className="h-11 col-span-2 sm:col-span-1">
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
        {/* Main first on mobile */}
        <div className="lg:col-span-3 order-1 lg:order-2 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="sticky top-0 z-10 -mx-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 pt-1">
              <TabsList className="w-full h-auto justify-start gap-1 overflow-x-auto flex-nowrap rounded-xl bg-muted/60 p-1 scrollbar-none">
                {[
                  ['people', 'People'],
                  ['departments', 'Depts'],
                  ['visits', 'Visits'],
                  ['equipment', 'Gear'],
                  ['tickets', 'Tickets'],
                  ['timeline', 'Activity'],
                ].map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="shrink-0 rounded-lg px-3.5 py-2.5 text-sm data-[state=active]:shadow-sm"
                  >
                    {label}
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
                <Button asChild variant="outline" className="h-11 w-full justify-start">
                  <a href={`mailto:${customer.email}`}>
                    <Mail className="mr-2 h-4 w-4 break-all" />
                    <span className="truncate">{customer.email}</span>
                  </a>
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
                  ['Depts', customer._count?.departments ?? customer.departments?.length ?? 0],
                  ['Visits', customer._count?.visits ?? customer.visits?.length ?? 0],
                  ['Gear', customer.equipmentInstallations?.length || 0],
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
    </div>
  );
}
