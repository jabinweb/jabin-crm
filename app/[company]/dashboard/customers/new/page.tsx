'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { CurrencySelect } from '@/components/ui/currency-select';
import { useWorkspaceTerminology } from '@/hooks/use-workspace-config';

export default function NewCustomerPage() {
  const router = useRouter();
  const { path, workspaceFetch } = useWorkspacePaths();
  const [saving, setSaving] = useState(false);
  const terminology = useWorkspaceTerminology();
  const pluralLabel = (terminology?.customers ?? 'Clients').toLowerCase();
  const singularLabel = (terminology?.customer ?? 'Client').toLowerCase();
  const [form, setForm] = useState({
    organizationName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    billingCurrency: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.organizationName.trim() || !form.contactPerson.trim()) {
      toast.error('Organization name and contact person are required');
      return;
    }
    setSaving(true);
    try {
      const res = await workspaceFetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Could not create ${singularLabel}`);
      }
      const customer = await res.json();
      toast.success(`${form.organizationName.trim()} added`);
      router.push(path(`/dashboard/customers/${customer.id}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not create ${singularLabel}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href={path('/dashboard/customers')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to {pluralLabel}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold tracking-tight">Add {singularLabel}</h1>
          <CardDescription>
            Add an organization you sell to or support. Fields marked * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization name *</Label>
              <Input
                id="organizationName"
                autoComplete="organization"
                value={form.organizationName}
                onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Primary contact *</Label>
              <Input
                id="contactPerson"
                autoComplete="name"
                value={form.contactPerson}
                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <CurrencySelect
              id="billingCurrency"
              label="Billing currency"
              allowEmpty
              emptyLabel="Use company default"
              value={form.billingCurrency}
              onValueChange={(value) => setForm((f) => ({ ...f, billingCurrency: String(value) }))}
              description="Quotes and invoices for this client will default to this currency."
            />
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {saving ? 'Creating…' : `Create ${singularLabel}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
