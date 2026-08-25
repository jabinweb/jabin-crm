'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { useSettings } from "@/contexts/settings-context"
import { CurrencySelect } from '@/components/ui/currency-select'
import { PRODUCT_DEFAULT_CURRENCY } from '@/lib/currency'
import { DashboardLink } from '@/components/navigation/dashboard-link'
import type { SettingsUpdatePayload } from '@/types/settings'

interface PaymentSectionProps {
  onChange?: (changes: SettingsUpdatePayload) => void;
}

export function PaymentSection({ onChange }: PaymentSectionProps) {
  const { settings } = useSettings()

  const defaultCurrency =
    settings?.billing?.defaultCurrency || PRODUCT_DEFAULT_CURRENCY

  const handleDefaultCurrencyChange = (value: string) => {
    onChange?.({
      settings: {
        billing: {
          defaultCurrency: value || PRODUCT_DEFAULT_CURRENCY,
        },
      },
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company currency</CardTitle>
          <CardDescription>
            Default for new deals, quotes, invoices, and contracts. Individual clients can override
            with their own billing currency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurrencySelect
            id="company-default-currency"
            label="Default currency"
            value={defaultCurrency}
            onValueChange={handleDefaultCurrencyChange}
            description="Changing this does not rewrite existing documents."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment integrations</CardTitle>
          <CardDescription>
            Razorpay and other payment providers are configured per company under Integrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <DashboardLink href="/dashboard/settings/integrations">
              Open integrations
            </DashboardLink>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
