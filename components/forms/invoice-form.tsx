'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface InvoiceItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface InvoiceFormData {
  title: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  dueDate: string;
  taxRate: number;
  discountRate: number;
  currency: string;
  terms: string;
  notes: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  iban: string;
  paymentInstructions: string;
}

interface InvoiceFormProps {
  mode: 'create' | 'edit';
  invoiceId?: string;
  initialData?: Partial<InvoiceFormData>;
  initialItems?: InvoiceItem[];
}

export function InvoiceForm({ mode, invoiceId, initialData, initialItems }: InvoiceFormProps) {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [formData, setFormData] = useState<InvoiceFormData>({
    title: '',
    description: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    taxRate: 0,
    discountRate: 0,
    currency: '',
    terms: 'Payment is due within 30 days',
    notes: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: '',
    iban: '',
    paymentInstructions: '',
    ...initialData,
  });

  const [items, setItems] = useState<InvoiceItem[]>(
    initialItems && initialItems.length > 0
      ? initialItems
      : [{ name: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }]
  );

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });

  const { data: leads } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const response = await fetch('/api/leads?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch leads');
      return response.json();
    },
  });

  const { data: quotations } = useQuery({
    queryKey: ['quotations-accepted'],
    queryFn: async () => {
      const response = await fetch('/api/quotations?status=ACCEPTED');
      if (!response.ok) throw new Error('Failed to fetch quotations');
      return response.json();
    },
  });

  // Set currency from profile settings
  useEffect(() => {
    if (profile && !isInitialized && !initialData?.currency) {
      setFormData((prev) => ({
        ...prev,
        currency: profile.preferredCurrency || 'USD',
      }));
      setIsInitialized(true);
    }
  }, [profile, isInitialized, initialData]);

  // Auto-expand payment details if they exist
  useEffect(() => {
    if (initialData && (
      initialData.bankName || initialData.accountName || initialData.accountNumber ||
      initialData.routingNumber || initialData.swiftCode || initialData.iban ||
      initialData.paymentInstructions
    )) {
      setShowPaymentDetails(true);
    }
  }, [initialData]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Invoice created successfully');
      router.push('/dashboard/invoices');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Invoice updated successfully');
      router.push('/dashboard/invoices');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/invoices/${id}/send`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Invoice sent successfully');
      router.push('/dashboard/invoices');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
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
      handleChange('customerName', lead.name);
      handleChange('customerEmail', lead.email);
      handleChange('customerPhone', lead.phone || '');
      handleChange('customerAddress', lead.address || '');
    }
  };

  const selectQuotation = (quotationId: string) => {
    const quotation = quotations?.quotations.find((q: any) => q.id === quotationId);
    if (quotation) {
      handleChange('title', quotation.title);
      handleChange('description', quotation.description || '');
      handleChange('customerName', quotation.customerName);
      handleChange('customerEmail', quotation.customerEmail);
      handleChange('customerPhone', quotation.customerPhone || '');
      handleChange('customerAddress', quotation.customerAddress || '');
      handleChange('taxRate', quotation.taxRate);
      handleChange('discountRate', quotation.discount ? Math.round((quotation.discount / quotation.subtotal) * 100 * 100) / 100 : 0);
      handleChange('currency', quotation.currency);
      handleChange('terms', quotation.terms || formData.terms);

      setItems(
        quotation.items.map((item: any) => ({
          name: item.name,
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        }))
      );
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTaxAmount = () => {
    return (calculateSubtotal() * formData.taxRate) / 100;
  };

  const calculateDiscountAmount = () => {
    return (calculateSubtotal() * formData.discountRate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount() - calculateDiscountAmount();
  };

  const handleSaveDraft = () => {
    const invoiceData = {
      ...formData,
      status: 'DRAFT',
      items: items.filter((item) => item.name.trim() !== ''),
      subtotal: calculateSubtotal(),
      taxAmount: calculateTaxAmount(),
      discount: calculateDiscountAmount(),
      total: calculateTotal(),
      amountPaid: 0,
      amountDue: calculateTotal(),
    };

    if (mode === 'edit') {
      updateInvoiceMutation.mutate(invoiceData);
    } else {
      createInvoiceMutation.mutate(invoiceData);
    }
  };

  const handleSaveAndSend = async () => {
    const invoiceData = {
      ...formData,
      status: 'DRAFT',
      items: items.filter((item) => item.name.trim() !== ''),
      subtotal: calculateSubtotal(),
      taxAmount: calculateTaxAmount(),
      discount: calculateDiscountAmount(),
      total: calculateTotal(),
      amountPaid: 0,
      amountDue: calculateTotal(),
    };

    if (mode === 'edit') {
      const invoice = await updateInvoiceMutation.mutateAsync(invoiceData);
      if (invoice?.id || invoiceId) {
        sendInvoiceMutation.mutate(invoice?.id || invoiceId!);
      }
    } else {
      const invoice = await createInvoiceMutation.mutateAsync(invoiceData);
      if (invoice?.id) {
        sendInvoiceMutation.mutate(invoice.id);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      AUD: 'A$',
      CAD: 'C$',
      JPY: '¥',
    };
    const symbol = symbols[formData.currency] || formData.currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  return (
    <div className="container mx-auto py-4 md:py-6 px-4 md:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {mode === 'edit' ? 'Edit Invoice' : 'Create Invoice'}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {mode === 'edit' ? 'Update invoice details' : 'Generate a new invoice for your customer'}
          </p>
        </div>
        <Link href="/dashboard/invoices">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Basic information about the invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'create' && quotations?.quotations && quotations.quotations.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="selectQuotation">Create from Quotation</Label>
                    <Select onValueChange={selectQuotation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an accepted quotation" />
                      </SelectTrigger>
                      <SelectContent>
                        {quotations.quotations.map((quotation: any) => (
                          <SelectItem key={quotation.id} value={quotation.id}>
                            {quotation.quotationNumber} - {quotation.customerName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                </>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Website Development Project"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Brief description of the invoice"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleChange('dueDate', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select value={formData.currency} onValueChange={(value) => handleChange('currency', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                      <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                      <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Who is this invoice for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'create' && leads?.leads && (
                <div className="space-y-2">
                  <Label htmlFor="selectLead">Select from Leads</Label>
                  <Select onValueChange={selectLead}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a lead to autofill details" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.leads.map((lead: any) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} - {lead.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mode === 'create' && <Separator />}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Customer Email *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleChange('customerEmail', e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Customer Phone</Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => handleChange('customerPhone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerAddress">Customer Address</Label>
                  <Input
                    id="customerAddress"
                    value={formData.customerAddress}
                    onChange={(e) => handleChange('customerAddress', e.target.value)}
                    placeholder="123 Main St, City, State"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Line Items</CardTitle>
                  <CardDescription>Add products or services</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 border rounded-none space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item #{index + 1}</span>
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Item Name *</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="Web Development"
                        required
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Description of the item"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Unit Price *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Amount</Label>
                      <div className="text-2xl font-bold text-primary">{formatCurrency(item.amount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terms">Payment Terms</Label>
                <Textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => handleChange('terms', e.target.value)}
                  placeholder="Payment is due within 30 days..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Internal Notes</Label>
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payment Details</CardTitle>
                  <CardDescription>Add payment information for customers</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentDetails(!showPaymentDetails)}
                >
                  {showPaymentDetails ? 'Hide' : 'Add Payment Info'}
                </Button>
              </div>
            </CardHeader>
            {showPaymentDetails && (
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => handleChange('bankName', e.target.value)}
                      placeholder="Chase Bank"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountName">Account Name</Label>
                    <Input
                      id="accountName"
                      value={formData.accountName}
                      onChange={(e) => handleChange('accountName', e.target.value)}
                      placeholder="Your Company Inc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber}
                      onChange={(e) => handleChange('accountNumber', e.target.value)}
                      placeholder="1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="routingNumber">Routing Number</Label>
                    <Input
                      id="routingNumber"
                      value={formData.routingNumber}
                      onChange={(e) => handleChange('routingNumber', e.target.value)}
                      placeholder="021000021"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="swiftCode">SWIFT/BIC Code</Label>
                    <Input
                      id="swiftCode"
                      value={formData.swiftCode}
                      onChange={(e) => handleChange('swiftCode', e.target.value)}
                      placeholder="CHASUS33"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN</Label>
                    <Input
                      id="iban"
                      value={formData.iban}
                      onChange={(e) => handleChange('iban', e.target.value)}
                      placeholder="GB29 NWBK 6016 1331 9268 19"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                    <Textarea
                      id="paymentInstructions"
                      value={formData.paymentInstructions}
                      onChange={(e) => handleChange('paymentInstructions', e.target.value)}
                      placeholder="Wire transfer details, online payment links, or other payment instructions..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.taxRate.toFixed(2)}
                    onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(calculateTaxAmount())}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="discount">Discount (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discountRate.toFixed(2)}
                    onChange={(e) => handleChange('discountRate', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount Amount</span>
                  <span className="text-red-600">{formatCurrency(calculateDiscountAmount())}</span>
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="text-lg font-semibold">Total Due</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                onClick={handleSaveDraft}
                disabled={
                  createInvoiceMutation.isPending ||
                  updateInvoiceMutation.isPending ||
                  !formData.title ||
                  !formData.customerName ||
                  !formData.customerEmail
                }
              >
                {createInvoiceMutation.isPending || updateInvoiceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {mode === 'edit' ? 'Update Invoice' : 'Save as Draft'}
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                variant="default"
                onClick={handleSaveAndSend}
                disabled={
                  createInvoiceMutation.isPending ||
                  updateInvoiceMutation.isPending ||
                  sendInvoiceMutation.isPending ||
                  !formData.title ||
                  !formData.customerName ||
                  !formData.customerEmail
                }
              >
                {sendInvoiceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {mode === 'edit' ? 'Update & Send Email' : 'Save & Send Email'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

