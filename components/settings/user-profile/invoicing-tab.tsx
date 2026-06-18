'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Info } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { type useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { ProfileSaveButton } from './profile-save-button';

type UserProfileSettingsState = ReturnType<typeof useUserProfileSettings>;

interface InvoicingTabProps extends Pick<
  UserProfileSettingsState,
  'formData' | 'handleChange' | 'updateProfileMutation'
> {}

export function InvoicingTab({ formData, handleChange, updateProfileMutation }: InvoicingTabProps) {
  return (
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

          <ProfileSaveButton updateProfileMutation={updateProfileMutation} />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
