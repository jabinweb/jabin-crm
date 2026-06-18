'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { type useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { ProfileSaveButton } from './profile-save-button';

type UserProfileSettingsState = ReturnType<typeof useUserProfileSettings>;

interface PaymentTabProps extends Pick<
  UserProfileSettingsState,
  'formData' | 'handleChange' | 'updateProfileMutation'
> {}

export function PaymentTab({ formData, handleChange, updateProfileMutation }: PaymentTabProps) {
  return (
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

          <ProfileSaveButton
            updateProfileMutation={updateProfileMutation}
            label="Save Payment Details"
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
