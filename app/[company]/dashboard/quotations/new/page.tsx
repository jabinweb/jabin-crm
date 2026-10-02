'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useFeatureModuleMap } from '@/components/feature-module-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useCurrency } from '@/hooks/use-currency';
import { CurrencySelect } from '@/components/ui/currency-select';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';
import { useParams } from 'next/navigation';

interface QuotationItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewQuotationPage() {
  const router = useRouter();
  const params = useParams<{ company?: string }>();
  const workspaceSlug = typeof params?.company === 'string' ? params.company : undefined;
  const { path } = useWorkspacePaths();
  const { currency: defaultCurrency, formatCurrency: formatMoney } = useCurrency();
  const [isInitialized, setIsInitialized] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    taxRate: 0,
    discount: 0,
    currency: '',
    terms: '',
    notes: '',
  });

  const [items, setItems] = useState<QuotationItem[]>([
    { name: '', description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);

  // The lead picker only loads when Leads is on the plan
  const planModules = useFeatureModuleMap();

  const { data: leads } = useQuery({
    queryKey: ['leads'],
    enabled: planModules?.LEADS === true,
    queryFn: async () => {
      const response = await fetch('/api/leads?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch leads');
      return response.json();
    },
  });

  useEffect(() => {
    if (!isInitialized && defaultCurrency) {
      setFormData((prev) => ({
        ...prev,
        currency: prev.currency || defaultCurrency,
      }));
      setIsInitialized(true);
    }
  }, [defaultCurrency, isInitialized]);

  useEffect(() => {
    if (!formData.customerEmail?.trim()) return;
    const email = formData.customerEmail.trim();
    let cancelled = false;
    const headers = workspaceSlug ? workspaceSlugHeaders(workspaceSlug) : {};
    void (async () => {
      const res = await fetch(
        `/api/currency/resolve?customerEmail=${encodeURIComponent(email)}`,
        { headers: { ...headers } }
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { currency?: string };
      if (data.currency && !cancelled) {
        setFormData((prev) => ({ ...prev, currency: data.currency! }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.customerEmail, workspaceSlug]);

  const createQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create quotation');
      }
      return response.json();
    },
  });

  const sendQuotationMutation = useMutation({
    mutationFn: async (quotationId: string) => {
      const response = await fetch(`/api/quotations/${quotationId}/send`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to send quotation');
      }
      return response.json();
    },
  });

  // Which button started the in-flight save, so only that one shows a spinner.
  // Stays set through the redirect so the buttons can't be pressed twice.
  const [pendingAction, setPendingAction] = useState<'draft' | 'send' | null>(null);
  const isBusy =
    pendingAction !== null || createQuotationMutation.isPending || sendQuotationMutation.isPending;

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    // Recalculate amount
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].amount = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }

    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const selectLead = (leadId: string) => {
    const lead = leads?.leads.find((l: any) => l.id === leadId);
    if (lead) {
      handleChange('customerName', lead.name || lead.contactName || lead.companyName || '');
      handleChange('customerEmail', lead.email || '');
      handleChange('customerPhone', lead.phone || '');
      handleChange('customerAddress', lead.address || '');
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTaxAmount = () => {
    return (calculateSubtotal() * formData.taxRate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount() - formData.discount;
  };

  // API takes validityDays; derive it from the chosen valid-until date
  const validityDaysFromDate = () => {
    const until = new Date(formData.validUntil + 'T23:59:59');
    if (Number.isNaN(until.getTime())) return undefined;
    return Math.max(1, Math.ceil((until.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  };

  const formatCurrency = (amount: number) =>
    formatMoney(amount, formData.currency || defaultCurrency);

  const requiredMissing =
    !formData.title.trim() || !formData.customerName.trim() || !formData.customerEmail.trim();

  /** Returns an error message, or null when the quotation can be saved. */
  const validate = (): string | null => {
    if (requiredMissing) return 'Add a title, customer name and customer email';
    if (!EMAIL_RE.test(formData.customerEmail.trim())) return 'Enter a valid customer email';
    if (!formData.validUntil) return 'Choose a valid-until date';
    if (!items.some((item) => item.name.trim() !== '')) return 'Add at least one line item with a name';
    if (formData.discount > calculateSubtotal() + calculateTaxAmount()) {
      return 'Discount can’t be larger than the subtotal plus tax';
    }
    return null;
  };

  const buildPayload = () => ({
    ...formData,
    validityDays: validityDaysFromDate(),
    status: 'DRAFT',
    items: items.filter(item => item.name.trim() !== ''),
    subtotal: calculateSubtotal(),
    taxAmount: calculateTaxAmount(),
    total: calculateTotal(),
  });

  const handleSaveDraft = async () => {
    if (isBusy) return;
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setPendingAction('draft');
    try {
      await createQuotationMutation.mutateAsync(buildPayload());
      toast.success('Quotation saved as draft');
      router.push(path('/dashboard/quotations'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create quotation');
      setPendingAction(null);
    }
  };

  const handleSaveAndSend = async () => {
    if (isBusy) return;
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setPendingAction('send');
    let quotation: { id?: string } | undefined;
    try {
      quotation = await createQuotationMutation.mutateAsync(buildPayload());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create quotation');
      setPendingAction(null);
      return;
    }
    if (!quotation?.id) {
      toast.success('Quotation saved as draft');
      router.push(path('/dashboard/quotations'));
      return;
    }
    try {
      await sendQuotationMutation.mutateAsync(quotation.id);
      toast.success('Quotation sent');
      router.push(path(`/dashboard/quotations/${quotation.id}`));
    } catch (err) {
      // The draft exists — take the user to it so they can retry sending.
      toast.error(
        `Saved as draft, but sending failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      router.push(path(`/dashboard/quotations/${quotation.id}`));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">New quotation</h1>
          <p className="text-sm text-muted-foreground">Prepare a quotation for your customer</p>
        </div>
        <DashboardLink href="/dashboard/quotations">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to quotations
          </Button>
        </DashboardLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotation details</CardTitle>
              <CardDescription>Basic information about the quotation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="e.g. Website redesign"
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Brief description of the quotation"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validUntil">Valid until *</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => handleChange('validUntil', e.target.value)}
                    required
                  />
                </div>

                <CurrencySelect
                  id="currency"
                  label="Currency *"
                  value={formData.currency}
                  onValueChange={(value) => handleChange('currency', value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer information</CardTitle>
              <CardDescription>Who is this quotation for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {leads?.leads && leads.leads.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="selectLead">Fill from a lead</Label>
                    <Select onValueChange={selectLead}>
                      <SelectTrigger id="selectLead">
                        <SelectValue placeholder="Choose a lead to autofill details" />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.leads.map((lead: any) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {[lead.name || lead.contactName || lead.companyName, lead.email]
                              .filter(Boolean)
                              .join(' · ') || 'Unnamed lead'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                </>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer name *</Label>
                  <Input
                    id="customerName"
                    autoComplete="off"
                    value={formData.customerName}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Customer email *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={formData.customerEmail}
                    onChange={(e) => handleChange('customerEmail', e.target.value)}
                    placeholder="name@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Customer phone</Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={formData.customerPhone}
                    onChange={(e) => handleChange('customerPhone', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerAddress">Customer address</Label>
                  <Input
                    id="customerAddress"
                    autoComplete="off"
                    value={formData.customerAddress}
                    onChange={(e) => handleChange('customerAddress', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">Line items</CardTitle>
                  <CardDescription>Add products or services</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-3 sm:p-4 border rounded-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor={`item-${index}-name`}>Item name *</Label>
                      <Input
                        id={`item-${index}-name`}
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="e.g. Web design"
                        required
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor={`item-${index}-description`}>Description</Label>
                      <Textarea
                        id={`item-${index}-description`}
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Description of the item"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`item-${index}-quantity`}>Quantity *</Label>
                      <Input
                        id={`item-${index}-quantity`}
                        type="number"
                        inputMode="decimal"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`item-${index}-unitPrice`}>Unit price *</Label>
                      <Input
                        id={`item-${index}-unitPrice`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <p className="text-sm font-medium">Amount</p>
                      <div className="break-words text-xl font-bold text-primary tabular-nums sm:text-2xl">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terms">Terms &amp; conditions</Label>
                <Textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => handleChange('terms', e.target.value)}
                  placeholder="This quotation is valid for 30 days from the date of issue..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Internal notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Internal notes (not shown to customer)"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{formatCurrency(calculateSubtotal())}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium tabular-nums">{formatCurrency(calculateTaxAmount())}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="discount">Discount</Label>
                  <Input
                    id="discount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => handleChange('discount', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <Separator />

                <div className="flex justify-between gap-2">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="break-all text-right text-2xl font-bold text-primary tabular-nums">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                onClick={() => void handleSaveAndSend()}
                disabled={isBusy || requiredMissing}
              >
                {pendingAction === 'send' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {sendQuotationMutation.isPending ? 'Sending…' : 'Saving…'}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Save &amp; send email
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => void handleSaveDraft()}
                disabled={isBusy || requiredMissing}
              >
                {pendingAction === 'draft' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save as draft
                  </>
                )}
              </Button>

              {requiredMissing ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  Add a title, customer name and email to continue.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
