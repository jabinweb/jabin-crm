'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { CurrencySelect } from '@/components/ui/currency-select';
import { Plus, Trash2, Save, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useCurrency } from '@/hooks/use-currency';
import { FormSkeleton } from '@/components/loading';

interface QuotationItem {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditQuotationPage() {
  const params = useParams();
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const { formatCurrency: formatMoney } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'not_found' | 'failed' | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    validUntil: '',
    taxRate: 0,
    discount: 0,
    currency: 'USD',
    terms: '',
    notes: '',
  });

  const [items, setItems] = useState<QuotationItem[]>([
    { name: '', description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);

  const detailPath = path(`/dashboard/quotations/${params.id}`);

  const fetchQuotation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/quotations/${params.id}`);
      if (response.status === 404) {
        setLoadError('not_found');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch quotation');
      const data = await response.json();

      setFormData({
        title: data.title,
        description: data.description || '',
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || '',
        customerAddress: data.customerAddress || '',
        validUntil: data.validUntil ? new Date(data.validUntil).toISOString().split('T')[0] : '',
        taxRate: data.taxRate,
        discount: data.discount,
        currency: data.currency,
        terms: data.terms || '',
        notes: data.notes || '',
      });

      setItems(
        (data.items ?? []).length > 0
          ? data.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              description: item.description || '',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
            }))
          : [{ name: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }]
      );
      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
      setLoadError('failed');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchQuotation();
  }, [fetchQuotation]);

  const updateQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/quotations/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update quotation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Quotation updated');
      router.push(detailPath);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

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

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTaxAmount = () => {
    return (calculateSubtotal() * formData.taxRate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount() - formData.discount;
  };

  const validate = (): string | null => {
    if (!formData.title.trim() || !formData.customerName.trim() || !formData.customerEmail.trim()) {
      return 'Add a title, customer name and customer email';
    }
    if (!EMAIL_RE.test(formData.customerEmail.trim())) return 'Enter a valid customer email';
    if (!formData.validUntil) return 'Choose a valid-until date';
    if (!items.some((item) => item.name.trim() !== '')) return 'Add at least one line item with a name';
    if (formData.discount > calculateSubtotal() + calculateTaxAmount()) {
      return 'Discount can’t be larger than the subtotal plus tax';
    }
    return null;
  };

  const handleSave = () => {
    if (updateQuotationMutation.isPending) return;
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    // API takes validityDays; derive it from the chosen valid-until date
    const until = new Date(formData.validUntil + 'T23:59:59');
    const validityDays = Number.isNaN(until.getTime())
      ? undefined
      : Math.max(1, Math.ceil((until.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const quotationData = {
      ...formData,
      validityDays,
      items: items.filter(item => item.name.trim() !== ''),
      subtotal: calculateSubtotal(),
      taxAmount: calculateTaxAmount(),
      total: calculateTotal(),
    };

    updateQuotationMutation.mutate(quotationData);
  };

  const formatCurrency = (amount: number) => formatMoney(amount, formData.currency);

  const header = (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Edit quotation</h1>
        <p className="text-sm text-muted-foreground">Update quotation details</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => router.push(detailPath)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Cancel
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <FormSkeleton fields={6} />
      </div>
    );
  }

  if (loadError) {
    const notFound = loadError === 'not_found';
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState
            icon={AlertCircle}
            title={notFound ? 'Quotation not found' : "Couldn't load this quotation"}
            description={
              notFound
                ? 'It may have been deleted, or you may not have access to it.'
                : 'Check your connection and try again.'
            }
            actionLabel={notFound ? 'Back to quotations' : 'Retry'}
            onAction={
              notFound
                ? () => router.push(path('/dashboard/quotations'))
                : () => void fetchQuotation()
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotation details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Name *</Label>
                  <Input
                    id="customerName"
                    autoComplete="off"
                    value={formData.customerName}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={formData.customerEmail}
                    onChange={(e) => handleChange('customerEmail', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={formData.customerPhone}
                    onChange={(e) => handleChange('customerPhone', e.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="customerAddress">Address</Label>
                  <Textarea
                    id="customerAddress"
                    value={formData.customerAddress}
                    onChange={(e) => handleChange('customerAddress', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Items</CardTitle>
                <Button type="button" variant="outline" onClick={addItem} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id ?? `new-${index}`} className="p-3 sm:p-4 border rounded-md space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Item {index + 1}</h4>
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

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <Label htmlFor={`item-${index}-name`}>Name *</Label>
                      <Input
                        id={`item-${index}-name`}
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor={`item-${index}-description`}>Description</Label>
                      <Input
                        id={`item-${index}-description`}
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`item-${index}-quantity`}>Quantity *</Label>
                      <Input
                        id={`item-${index}-quantity`}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
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

                    <div className="space-y-1 col-span-2 md:col-span-1">
                      <p className="text-sm font-medium">Amount</p>
                      <div className="text-lg font-semibold tabular-nums">{formatCurrency(item.amount)}</div>
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
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.taxRate}
                  onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                />
              </div>

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

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({formData.taxRate}%)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(calculateTaxAmount())}</span>
                </div>
                {formData.discount > 0 ? (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatCurrency(formData.discount)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between gap-2 text-lg font-bold">
                  <span>Total</span>
                  <span className="break-all text-right tabular-nums">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button
              onClick={handleSave}
              disabled={updateQuotationMutation.isPending || updateQuotationMutation.isSuccess}
              className="w-full"
            >
              {updateQuotationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
