'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, PackageOpen, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { InventoryAlert } from '@/types/inventory'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { SectionSkeleton } from '@/components/loading'

export function AlertsPanel() {
  const params = useParams<{ company?: string }>()
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (typeof params?.company !== 'string') return

    async function fetchAlerts() {
      try {
        const response = await fetch('/api/inventory/alerts', {
          headers: workspaceSlugHeaders(params.company as string),
        })
        if (!response.ok) throw new Error('Failed to load alerts')
        const data = await response.json()
        setAlerts([...(data.data?.lowStock ?? []), ...(data.data?.expiringSoon ?? [])])
        setStatus('ready')
      } catch {
        setStatus((prev) => (prev === 'ready' ? prev : 'error'))
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [params?.company])

  return (
    <Card className="min-w-0 p-4">
      <h2 className="mb-4 font-semibold">Inventory alerts</h2>
      {status === 'loading' ? (
        <SectionSkeleton lines={3} />
      ) : status === 'error' ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load alerts right now. They will refresh automatically.
        </p>
      ) : alerts.length === 0 ? (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>No alerts — nothing is below its minimum level or expiring soon.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert, idx) => (
            <Alert key={`${alert.type}-${alert.product.id}-${idx}`}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex flex-wrap items-center gap-2">
                {alert.type === 'LOW_STOCK' ? (
                  <PackageOpen className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                {alert.product.name}
                <Badge variant={alert.type === 'LOW_STOCK' ? 'destructive' : 'secondary'}>
                  {alert.type === 'LOW_STOCK' ? 'Low stock' : 'Expiring soon'}
                </Badge>
              </AlertTitle>
              <AlertDescription>
                {alert.type === 'LOW_STOCK' ? (
                  `Current quantity (${alert.currentQuantity}) is below the minimum (${alert.threshold}).`
                ) : (
                  `Expires ${formatDistanceToNow(new Date(alert.expiryDate!), { addSuffix: true })}.`
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </Card>
  )
}
