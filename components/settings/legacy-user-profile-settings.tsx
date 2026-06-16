'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Building, Save, Loader2, Mail, Key, Sparkles, Globe, Info, Eye, EyeOff, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function LegacyUserProfileSettings() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGooglePlacesKey, setShowGooglePlacesKey] = useState(false);
  const [geminiKeyTouched, setGeminiKeyTouched] = useState(false);
  const [googlePlacesKeyTouched, setGooglePlacesKeyTouched] = useState(false);
  const [loadingGeminiKey, setLoadingGeminiKey] = useState(false);
  const [loadingGooglePlacesKey, setLoadingGooglePlacesKey] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    description: '',
    service: '',
    targetAudience: '',
    valueProposition: '',
    geminiApiKey: '',
    googlePlacesApiKey: '',
    aiModel: 'gemini-2.0-flash',
    preferredCurrency: 'USD',
    // Invoice & Quotation Settings
    companyAddress: '',
    companyEmail: '',
    companyPhone: '',
    taxId: '',
    invoicePrefix: 'INV',
    quotationPrefix: 'QT',
    invoiceTerms: 'Payment is due within 30 days',
    quotationTerms: 'This quotation is valid for 30 days from the date of issue',
    // Payment Details
    bankName: '',
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: '',
    iban: '',
    paymentInstructions: '',
    // Template Customization
    templateStyle: 'modern',
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    logoUrl: '',
    headerText: '',
    footerText: '',
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
  });

  const { data: availableModels, isLoading: modelsLoading, refetch: refetchModels } = useQuery({
    queryKey: ['available-models'],
    queryFn: async () => {
      const response = await fetch('/api/ai/models');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch models');
      }
      return response.json();
    },
    enabled: false, // Don't fetch automatically
    retry: false,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        companyName: profile.companyName || '',
        industry: profile.industry || '',
        companySize: profile.companySize || '',
        website: profile.website || '',
        description: profile.description || '',
        service: profile.service || '',
        targetAudience: profile.targetAudience || '',
        valueProposition: profile.valueProposition || '',
        // Show placeholder bullets when key exists (unless user has edited the field)
        geminiApiKey: geminiKeyTouched ? formData.geminiApiKey : (profile.geminiApiKey || ''),
        googlePlacesApiKey: googlePlacesKeyTouched ? formData.googlePlacesApiKey : (profile.googlePlacesApiKey || ''),
        aiModel: profile.aiModel || 'gemini-2.0-flash',
        preferredCurrency: profile.preferredCurrency || 'USD',
        // Invoice & Quotation Settings
        companyAddress: profile.companyAddress || '',
        companyEmail: profile.companyEmail || '',
        companyPhone: profile.companyPhone || '',
        taxId: profile.taxId || '',
        invoicePrefix: profile.invoicePrefix || 'INV',
        quotationPrefix: profile.quotationPrefix || 'QT',
        invoiceTerms: profile.invoiceTerms || 'Payment is due within 30 days',
        quotationTerms: profile.quotationTerms || 'This quotation is valid for 30 days from the date of issue',
        // Payment Details
        bankName: profile.bankName || '',
        accountName: profile.accountName || '',
        accountNumber: profile.accountNumber || '',
        routingNumber: profile.routingNumber || '',
        swiftCode: profile.swiftCode || '',
        iban: profile.iban || '',
        paymentInstructions: profile.paymentInstructions || '',
        // Template Customization
        templateStyle: profile.templateStyle || 'modern',
        primaryColor: profile.primaryColor || '#2563eb',
        secondaryColor: profile.secondaryColor || '#7c3aed',
        logoUrl: profile.logoUrl || '',
        headerText: profile.headerText || '',
        footerText: profile.footerText || '',
      });
      // Reset touched state after loading profile
      if (!geminiKeyTouched) setGeminiKeyTouched(false);
      if (!googlePlacesKeyTouched) setGooglePlacesKeyTouched(false);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Profile updated successfully');
      // Reset touched states after successful save
      setGeminiKeyTouched(false);
      setGooglePlacesKeyTouched(false);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      // If Gemini API key was updated, refetch available models
      if (variables.geminiApiKey && variables.geminiApiKey !== profile?.geminiApiKey && variables.geminiApiKey !== '••••••••') {
        setTimeout(() => refetchModels(), 500);
      }
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const fetchDecryptedKey = async (keyType: 'geminiApiKey' | 'googlePlacesApiKey') => {
    try {
      if (keyType === 'geminiApiKey') {
        setLoadingGeminiKey(true);
      } else {
        setLoadingGooglePlacesKey(true);
      }

      const response = await fetch('/api/profile/decrypt-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyType }),
      });

      if (!response.ok) {
        throw new Error('Failed to decrypt key');
      }

      const data = await response.json();
      
      if (data.decryptedKey) {
        handleChange(keyType, data.decryptedKey);
        if (keyType === 'geminiApiKey') {
          setGeminiKeyTouched(true);
        } else {
          setGooglePlacesKeyTouched(true);
        }
      }
    } catch (error) {
      console.error('Error fetching decrypted key:', error);
      toast.error('Failed to load API key');
    } finally {
      if (keyType === 'geminiApiKey') {
        setLoadingGeminiKey(false);
      } else {
        setLoadingGooglePlacesKey(false);
      }
    }
  };

  const toggleGeminiKeyVisibility = async () => {
    if (!showGeminiKey && formData.geminiApiKey === '••••••••') {
      // Fetch the real key when showing for the first time
      await fetchDecryptedKey('geminiApiKey');
    }
    setShowGeminiKey(!showGeminiKey);
  };

  const toggleGooglePlacesKeyVisibility = async () => {
    if (!showGooglePlacesKey && formData.googlePlacesApiKey === '••••••••') {
      // Fetch the real key when showing for the first time
      await fetchDecryptedKey('googlePlacesApiKey');
    }
    setShowGooglePlacesKey(!showGooglePlacesKey);
  };

  const handleChange = (field: string, value: string | boolean | number) => {
    if (field === 'smtpPort') {
      setFormData(prev => ({ ...prev, [field]: parseInt(value as string) || 587 }));
    } else if (field === 'smtpSecure' || field === 'useAdminEmail') {
      setFormData(prev => ({ ...prev, [field]: value === 'true' || value === true }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 pb-8">
      <div className="border-b pb-6 mb-8 mt-2">
        <h2 className="text-xl font-black uppercase tracking-[0.2em]">Core Configuration</h2>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-widest opacity-60">
          User ID: {session?.user?.id?.slice(-8).toUpperCase()} • System Parameters
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Workspace company identity (the shared team record) is edited under your tenant URL, for example
          /your-company/dashboard/settings. This screen updates your personal user profile: email integrations,
          AI API keys, and related fields stored on your account.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-full grid-cols-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
            <span className="sm:hidden">Info</span>
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Invoicing</span>
            <span className="sm:hidden">Invoice</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="hidden sm:inline">Payment</span>
            <span className="sm:hidden">Pay</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span className="hidden sm:inline">Templates</span>
            <span className="sm:hidden">Theme</span>
          </TabsTrigger>
          <TabsTrigger value="ai-personalization" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Setup</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
            <span className="sm:hidden">Keys</span>
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit}>
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
                  <Building className="h-4 w-4" />
                  Personnel / Entity Data
                </CardTitle>
                <CardDescription className="text-[9px] uppercase tracking-widest font-bold opacity-50">
                  Base operational parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName" className="text-[9px] uppercase font-bold tracking-widest opacity-70">Legal Entity Name *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      placeholder="Your company name"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="industry" className="text-[9px] uppercase font-bold tracking-widest opacity-70">Sector Classification *</Label>
                    <Select value={formData.industry} onValueChange={(value) => handleChange('industry', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Healthcare">Healthcare</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="Retail">Retail</SelectItem>
                        <SelectItem value="Real Estate">Real Estate</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Consulting">Consulting</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companySize">Company Size</Label>
                    <Select value={formData.companySize} onValueChange={(value) => handleChange('companySize', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-200">51-200 employees</SelectItem>
                        <SelectItem value="201-500">201-500 employees</SelectItem>
                        <SelectItem value="500+">500+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="website" className="text-[9px] uppercase font-bold tracking-widest opacity-70">Web Gateway</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="website"
                        type="url"
                        value={formData.website}
                        onChange={(e) => handleChange('website', e.target.value)}
                        placeholder="https://yourcompany.com"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredCurrency">Preferred Currency</Label>
                    <Select 
                      key={`currency-${formData.preferredCurrency}`}
                      value={formData.preferredCurrency} 
                      onValueChange={(value) => handleChange('preferredCurrency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                        <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                        <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                        <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                        <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                        <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                        <SelectItem value="CHF">CHF - Swiss Franc (Fr)</SelectItem>
                        <SelectItem value="SGD">SGD - Singapore Dollar (S$)</SelectItem>
                        <SelectItem value="AED">AED - UAE Dirham (د.إ)</SelectItem>
                        <SelectItem value="BRL">BRL - Brazilian Real (R$)</SelectItem>
                        <SelectItem value="MXN">MXN - Mexican Peso ($)</SelectItem>
                        <SelectItem value="ZAR">ZAR - South African Rand (R)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Current: {formData.preferredCurrency}</p>
                  </div>
                </div>
                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="description">Company Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Brief description of your company"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Help AI understand what your company does
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoicing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
                  <FileText className="h-4 w-4" />
                  Financial Documentation Protocols
                </CardTitle>
                <CardDescription>
                  Configure your company details for invoices and quotations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Company Address</Label>
                    <Textarea
                      id="companyAddress"
                      value={formData.companyAddress}
                      onChange={(e) => handleChange('companyAddress', e.target.value)}
                      placeholder="123 Business Street, City, State, ZIP"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Address shown on invoices and quotations
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Company Email</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        value={formData.companyEmail}
                        onChange={(e) => handleChange('companyEmail', e.target.value)}
                        placeholder="invoices@company.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Contact email for invoicing
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Company Phone</Label>
                      <Input
                        id="companyPhone"
                        type="tel"
                        value={formData.companyPhone}
                        onChange={(e) => handleChange('companyPhone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="taxId">Tax ID / Registration Number</Label>
                    <Input
                      id="taxId"
                      value={formData.taxId}
                      onChange={(e) => handleChange('taxId', e.target.value)}
                      placeholder="XX-XXXXXXX"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your business tax identification number
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                      <Input
                        id="invoicePrefix"
                        value={formData.invoicePrefix}
                        onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                        placeholder="INV"
                        maxLength={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        e.g., INV-001
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quotationPrefix">Quote Prefix</Label>
                      <Input
                        id="quotationPrefix"
                        value={formData.quotationPrefix}
                        onChange={(e) => handleChange('quotationPrefix', e.target.value)}
                        placeholder="QT"
                        maxLength={5}
                      />
                      <p className="text-xs text-muted-foreground">
                        e.g., QT-001
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceTerms">Default Invoice Terms</Label>
                    <Textarea
                      id="invoiceTerms"
                      value={formData.invoiceTerms}
                      onChange={(e) => handleChange('invoiceTerms', e.target.value)}
                      placeholder="Payment is due within 30 days"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Standard payment terms for all invoices
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quotationTerms">Default Quotation Terms</Label>
                    <Textarea
                      id="quotationTerms"
                      value={formData.quotationTerms}
                      onChange={(e) => handleChange('quotationTerms', e.target.value)}
                      placeholder="This quotation is valid for 30 days from the date of issue"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Standard terms for all quotations
                    </p>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    These settings will be used as defaults when generating invoices and quotations. 
                    You can override them for individual documents.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Payment Information
                </CardTitle>
                <CardDescription>
                  Bank details and payment instructions for invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Add your payment details to include them in invoices. This makes it easier for clients to pay you.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-6 md:grid-cols-2">
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
                      placeholder="Your Company Name"
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
                    <Label htmlFor="routingNumber">Routing Number / Sort Code</Label>
                    <Input
                      id="routingNumber"
                      value={formData.routingNumber}
                      onChange={(e) => handleChange('routingNumber', e.target.value)}
                      placeholder="021000021"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="swiftCode">SWIFT / BIC Code</Label>
                    <Input
                      id="swiftCode"
                      value={formData.swiftCode}
                      onChange={(e) => handleChange('swiftCode', e.target.value)}
                      placeholder="CHASUS33"
                    />
                    <p className="text-xs text-muted-foreground">
                      For international payments
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN</Label>
                    <Input
                      id="iban"
                      value={formData.iban}
                      onChange={(e) => handleChange('iban', e.target.value)}
                      placeholder="GB29 NWBK 6016 1331 9268 19"
                    />
                    <p className="text-xs text-muted-foreground">
                      International Bank Account Number
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                  <Textarea
                    id="paymentInstructions"
                    value={formData.paymentInstructions}
                    onChange={(e) => handleChange('paymentInstructions', e.target.value)}
                    placeholder="Additional payment instructions, alternative payment methods (PayPal, Venmo, etc.), or special notes"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    This will appear on invoices along with your bank details
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Payment Details
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Template Customization
                </CardTitle>
                <CardDescription>
                  Customize the appearance of your invoices and quotations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="templateStyle">Template Style</Label>
                  <Select 
                    value={formData.templateStyle} 
                    onValueChange={(value) => handleChange('templateStyle', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern - Clean and contemporary</SelectItem>
                      <SelectItem value="classic">Classic - Traditional business style</SelectItem>
                      <SelectItem value="minimal">Minimal - Simple and elegant</SelectItem>
                      <SelectItem value="corporate">Corporate - Professional and formal</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the overall design style for your documents
                  </p>
                </div>

                <Separator />

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        placeholder="#2563eb"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for headers and accents
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={formData.secondaryColor}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        placeholder="#7c3aed"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for quotation highlights
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={formData.logoUrl}
                    onChange={(e) => handleChange('logoUrl', e.target.value)}
                    placeholder="https://yourdomain.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload your logo online and paste the URL here. Recommended size: 200x80px
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="headerText">Custom Header Text</Label>
                    <Textarea
                      id="headerText"
                      value={formData.headerText}
                      onChange={(e) => handleChange('headerText', e.target.value)}
                      placeholder="Optional custom text to appear in the header of documents"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="footerText">Custom Footer Text</Label>
                    <Textarea
                      id="footerText"
                      value={formData.footerText}
                      onChange={(e) => handleChange('footerText', e.target.value)}
                      placeholder="Thank you for your business! We look forward to working with you."
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      This will replace the default footer text on invoices and quotations
                    </p>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Template changes will apply to all new invoices and quotations. Existing documents won't be affected.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Template Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-personalization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Personalization
                </CardTitle>
                <CardDescription>
                  This information powers AI-generated cold emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    The more detailed and specific you are, the better your AI-generated emails will perform.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="service">Your Service/Product *</Label>
                  <Textarea
                    id="service"
                    value={formData.service}
                    onChange={(e) => handleChange('service', e.target.value)}
                    placeholder="What service or product do you offer?"
                    rows={3}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific - this will be used in email personalization
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetAudience">Target Audience</Label>
                  <Input
                    id="targetAudience"
                    value={formData.targetAudience}
                    onChange={(e) => handleChange('targetAudience', e.target.value)}
                    placeholder="e.g., Small business owners, CMOs, Healthcare providers"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valueProposition">Value Proposition *</Label>
                  <Textarea
                    id="valueProposition"
                    value={formData.valueProposition}
                    onChange={(e) => handleChange('valueProposition', e.target.value)}
                    placeholder="What makes your offer unique? How do you help customers?"
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be used to craft compelling cold emails
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  API Configuration
                </CardTitle>
                <CardDescription>
                  Use your own API keys to avoid rate limits and quota issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your API keys are encrypted and stored securely. They're only used when you run scraping jobs.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="geminiApiKey" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Gemini API Key
                      </Label>
                      <span className="text-xs text-muted-foreground">Optional</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="geminiApiKey"
                        type={showGeminiKey ? "text" : "password"}
                        value={formData.geminiApiKey}
                        onFocus={(e) => {
                          if (e.target.value === '••••••••') {
                            setGeminiKeyTouched(true);
                            handleChange('geminiApiKey', '');
                          }
                        }}
                        onChange={(e) => {
                          setGeminiKeyTouched(true);
                          handleChange('geminiApiKey', e.target.value);
                        }}
                        placeholder="Enter your Gemini API key"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={toggleGeminiKeyVisibility}
                        disabled={loadingGeminiKey}
                      >
                        {loadingGeminiKey ? (
                          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                        ) : showGeminiKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <div>
                        Get your free API key from{' '}
                        <a 
                          href="https://ai.google.dev" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline font-medium"
                        >
                          Google AI Studio
                        </a>
                        . Used for AI-powered lead enrichment and data generation.
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => refetchModels()}
                      disabled={modelsLoading || !formData.geminiApiKey}
                      className="mt-2"
                    >
                      {modelsLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Test API Key & Show Available Models'
                      )}
                    </Button>
                    {availableModels?.models && (
                      <Alert className="mt-2">
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-medium mb-1">
                            ✓ API key valid! {availableModels.models.length} models available
                            {availableModels.usingUserKey && ' (using your key)'}
                          </div>
                          <div className="text-xs space-y-1">
                            {availableModels.models.slice(0, 5).map((model: any) => (
                              <div key={model.name} className="flex items-start gap-2">
                                <span className="font-mono text-primary">{model.name}</span>
                              </div>
                            ))}
                            {availableModels.models.length > 5 && (
                              <div className="text-muted-foreground">
                                ...and {availableModels.models.length - 5} more
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="aiModel" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Model
                      </Label>
                      {availableModels?.models?.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {availableModels.models.length} available
                        </span>
                      )}
                    </div>
                    <Select
                      value={formData.aiModel}
                      onValueChange={(value) => handleChange('aiModel', value)}
                    >
                      <SelectTrigger id="aiModel">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {availableModels?.models?.length > 0 ? (
                          <>
                            {/* Show currently selected model first if not in fetched list */}
                            {formData.aiModel && !availableModels.models.find((m: any) => m.name === formData.aiModel) && (
                              <SelectItem value={formData.aiModel}>
                                {formData.aiModel} (Current)
                              </SelectItem>
                            )}
                            {availableModels.models.map((model: any) => (
                              <SelectItem key={model.name} value={model.name}>
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">{model.displayName}</span>
                                  {model.name !== model.displayName && (
                                    <span className="text-xs text-muted-foreground">{model.name}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        ) : (
                          <>
                            {/* Show currently selected model first if not in defaults */}
                            {formData.aiModel && !['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'].includes(formData.aiModel) && (
                              <SelectItem value={formData.aiModel}>
                                {formData.aiModel} (Current)
                              </SelectItem>
                            )}
                            <SelectItem value="gemini-2.0-flash">
                              Gemini 2.0 Flash (Recommended)
                            </SelectItem>
                            <SelectItem value="gemini-2.5-flash">
                              Gemini 2.5 Flash
                            </SelectItem>
                            <SelectItem value="gemini-2.5-pro">
                              Gemini 2.5 Pro
                            </SelectItem>
                            <SelectItem value="gemini-1.5-pro">
                              Gemini 1.5 Pro
                            </SelectItem>
                            <SelectItem value="gemini-1.5-flash">
                              Gemini 1.5 Flash
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {availableModels?.models?.length > 0 
                        ? `Choose from ${availableModels.models.length} available models from your API key`
                        : 'Test your API key above to load available models, or select from defaults'
                      }
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="googlePlacesApiKey" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Google Places API Key
                      </Label>
                      <span className="text-xs text-muted-foreground">Optional</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="googlePlacesApiKey"
                        type={showGooglePlacesKey ? "text" : "password"}
                        value={formData.googlePlacesApiKey}
                        onFocus={(e) => {
                          if (e.target.value === '••••••••') {
                            setGooglePlacesKeyTouched(true);
                            handleChange('googlePlacesApiKey', '');
                          }
                        }}
                        onChange={(e) => {
                          setGooglePlacesKeyTouched(true);
                          handleChange('googlePlacesApiKey', e.target.value);
                        }}
                        placeholder="Enter your Google Places API key"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={toggleGooglePlacesKeyVisibility}
                        disabled={loadingGooglePlacesKey}
                      >
                        {loadingGooglePlacesKey ? (
                          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                        ) : showGooglePlacesKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <div>
                        Get your API key from{' '}
                        <a 
                          href="https://console.cloud.google.com/apis/credentials" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline font-medium"
                        >
                          Google Cloud Console
                        </a>
                        . Enable the Places API for your project. Used for verified business data and lead scraping.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save API Keys
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </form>
      </Tabs>
    </div>
  );
}
