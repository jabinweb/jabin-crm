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
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

interface QuotationItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
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

  // Set currency from profile settings
  useEffect(() => {
    if (profile && !isInitialized) {
      setFormData(prev => ({ 
        ...prev, 
        currency: profile.preferredCurrency || 'USD' 
      }));
      setIsInitialized(true);
    }
  }, [profile, isInitialized]);

  const createQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create quotation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Quotation created successfully');
      router.push(path('/dashboard/quotations'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendQuotationMutation = useMutation({
    mutationFn: async (quotationId: string) => {
      const response = await fetch(`/api/quotations/${quotationId}/send`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send quotation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Quotation sent successfully');
      router.push(path('/dashboard/quotations'));
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

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTaxAmount = () => {
    return (calculateSubtotal() * formData.taxRate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount() - formData.discount;
  };

  const handleSaveDraft = () => {
    const quotationData = {
      ...formData,
      status: 'DRAFT',
      items: items.filter(item => item.name.trim() !== ''),
      subtotal: calculateSubtotal(),
      taxAmount: calculateTaxAmount(),
      total: calculateTotal(),
    };

    createQuotationMutation.mutate(quotationData);
  };

  const handleSaveAndSend = async () => {
    const quotationData = {
      ...formData,
      status: 'DRAFT',
      items: items.filter(item => item.name.trim() !== ''),
      subtotal: calculateSubtotal(),
      taxAmount: calculateTaxAmount(),
      total: calculateTotal(),
    };

    const quotation = await createQuotationMutation.mutateAsync(quotationData);
    if (quotation?.id) {
      sendQuotationMutation.mutate(quotation.id);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Create Quotation</h1>
          <p className="text-sm md:text-base text-muted-foreground">Generate a new quotation for your customer</p>
        </div>
        <DashboardLink href="/dashboard/quotations">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quotations
          </Button>
        </DashboardLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quotation Details</CardTitle>
              <CardDescription>Basic information about the quotation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Web Development Services"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
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
                  <Label htmlFor="validUntil">Valid Until *</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => handleChange('validUntil', e.target.value)}
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
              <CardDescription>Who is this quotation for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {leads?.leads && (
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

              <Separator />

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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
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
                        placeholder="Web Design"
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
                      <div className="text-2xl font-bold text-primary">
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
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => handleChange('terms', e.target.value)}
                  placeholder="This quotation is valid for 30 days from the date of issue..."
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
                    value={formData.taxRate}
                    onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(calculateTaxAmount())}</span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="discount">Discount</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => handleChange('discount', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(calculateTotal())}
                  </span>
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
                disabled={createQuotationMutation.isPending || !formData.title || !formData.customerName || !formData.customerEmail}
              >
                {createQuotationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save as Draft
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                variant="default"
                onClick={handleSaveAndSend}
                disabled={
                  createQuotationMutation.isPending ||
                  sendQuotationMutation.isPending ||
                  !formData.title ||
                  !formData.customerName ||
                  !formData.customerEmail
                }
              >
                {sendQuotationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Save & Send Email
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

