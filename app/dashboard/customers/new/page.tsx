'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    organizationName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.organizationName || !form.contactPerson) {
      toast.error('Organization name and contact person are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create customer');
      const customer = await res.json();
      toast.success('Customer created');
      router.push(`/dashboard/customers/${customer.id}`);
    } catch {
      toast.error('Could not create customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-lg py-8 space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/customers">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to customers
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Add customer</CardTitle>
          <CardDescription>Create a support portal account for an organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization name *</Label>
              <Input
                id="organizationName"
                value={form.organizationName}
                onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Primary contact *</Label>
              <Input
                id="contactPerson"
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
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create customer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
