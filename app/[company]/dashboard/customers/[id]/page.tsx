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
import { CURRENCIES } from '@/lib/currency';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-3xl font-bold tracking-tight">{customer.organizationName}</h2>
            <Badge variant="outline">{customer.city || 'Location Pending'}</Badge>
          </div>
          <p className="text-muted-foreground flex items-center">
            <MapPin className="h-4 w-4 mr-1 text-primary" />
            {customer.address || 'No address provided'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleInviteToPortal} disabled={isInviting}>
            <User className="mr-2 h-4 w-4" />
            {isInviting ? 'Inviting…' : 'Invite to portal'}
          </Button>
          <Button variant="outline" onClick={handleExportHistory}>
            <Download className="mr-2 h-4 w-4" />
            Export History
          </Button>
          <Button asChild>
            <Link href={path(`/dashboard/tickets/new?customerId=${id}`)}>
              <Ticket className="mr-2 h-4 w-4" />
              New Ticket
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
              <CardTitle className="text-sm font-medium">Billing currency</CardTitle>
              <CardDescription>
                Overrides company default for this client&apos;s new quotes and invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CurrencySelect
                id="customer-billing-currency"
                label=""
                allowEmpty
                emptyLabel="Use company default"
                value={billingCurrencyValue}
                onValueChange={(value) => setBillingCurrencyDraft(String(value))}
              />
              {customer.billingCurrency ? (
                <p className="text-xs text-muted-foreground">
                  Current:{' '}
                  {CURRENCIES[customer.billingCurrency as keyof typeof CURRENCIES]
                    ? `${customer.billingCurrency} (${CURRENCIES[customer.billingCurrency as keyof typeof CURRENCIES].symbol})`
                    : customer.billingCurrency}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Using company default</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={savingCurrency || billingCurrencyDraft === null}
                onClick={handleSaveBillingCurrency}
              >
                {savingCurrency ? 'Saving…' : 'Save currency'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>People</span>
                <span className="font-semibold text-foreground">
                  {customer._count?.contacts ?? customer.contacts?.length ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Departments</span>
                <span className="font-semibold text-foreground">
                  {customer._count?.departments ?? customer.departments?.length ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Visits</span>
                <span className="font-semibold text-foreground">
                  {customer._count?.visits ?? customer.visits?.length ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Equipment</span>
                <span className="font-semibold text-foreground">
                  {customer.equipmentInstallations?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Open Tickets</span>
                <span className="font-semibold text-foreground">
                  {customer.supportTickets?.filter(
                    (t: { status: string }) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'
                  ).length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/50 p-1 flex flex-wrap h-auto">
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
              <TabsTrigger value="visits">Visits</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
              <TabsTrigger value="timeline">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="space-y-6">
              <CustomerPeopleTab
                customerId={customerId}
                slug={slug}
                contacts={customer.contacts || []}
                departments={customer.departments || []}
                workspaceFetch={workspaceFetch}
              />
            </TabsContent>

            <TabsContent value="departments" className="space-y-6">
              <CustomerDepartmentsTab
                customerId={customerId}
                slug={slug}
                departments={customer.departments || []}
                workspaceFetch={workspaceFetch}
              />
            </TabsContent>

            <TabsContent value="visits" className="space-y-6">
              <CustomerVisitsTab
                customerId={customerId}
                slug={slug}
                visits={customer.visits || []}
                contacts={customer.contacts || []}
                departments={customer.departments || []}
                workspaceFetch={workspaceFetch}
              />
            </TabsContent>

            <TabsContent value="equipment" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Installed Equipment</CardTitle>
                    <CardDescription>Products and assets installed for this client.</CardDescription>
                  </div>
                  <Button asChild size="sm">
                    <Link href={path(`/dashboard/inventory/new?customerId=${id}`)}>
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
                        <TableHead className="text-right">QR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.equipmentInstallations?.map((eq: any) => (
                        <TableRow key={eq.id}>
                          <TableCell className="font-medium">
                            {eq.product?.name || 'Unknown'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{eq.serialNumber}</TableCell>
                          <TableCell>
                            {new Date(eq.installationDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {eq.warrantyExpiry
                              ? new Date(eq.warrantyExpiry).toLocaleDateString()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={eq.status === 'ACTIVE' ? 'default' : 'secondary'}>
                              {eq.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  QR link
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Equipment service QR</DialogTitle>
                                  <DialogDescription>
                                    Stick this QR on the machine so staff can raise a ticket for
                                    this unit only.
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
                  <CardDescription>
                    Track all service requests and technical issues.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {!customer.supportTickets?.length ? (
                      <p className="text-sm text-muted-foreground italic py-4">
                        No support tickets yet.
                      </p>
                    ) : (
                      customer.supportTickets.map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => router.push(path(`/dashboard/tickets/${ticket.id}`))}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{ticket.subject}</p>
                              <Badge
                                variant={
                                  ticket.priority === 'CRITICAL' ? 'destructive' : 'outline'
                                }
                              >
                                {ticket.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              ID: {ticket.id} • Created on{' '}
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            className={cn(
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
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Timeline</CardTitle>
                  <CardDescription>
                    Full history of interactions, visits, and installations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                    {customer.activities?.map((activity: any) => (
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
