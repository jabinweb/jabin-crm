'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from '@/hooks/use-toast'
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog"
import { TransactionHistoryDialog } from "@/components/inventory/transaction-history-dialog"
import { AlertsPanel } from "@/components/inventory/alerts-panel"

export default function StockAdjustmentPage() {
  const params = useParams<{ company: string }>()
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    if (params.company) fetchProducts()
  }, [params.company])

  async function fetchProducts() {
    const response = await fetch('/api/inventory', {
      headers: workspaceSlugHeaders(params.company),
    })
    if (response.ok) {
      const data = await response.json()
      setProducts(data?.data?.products ?? [])
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stock Adjustment</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="min-w-0 p-6">
          {/* Stock Adjustment content */}
          <Button onClick={() => setShowAdjustmentDialog(true)}>Adjust stock</Button>
          <StockAdjustmentDialog
            open={showAdjustmentDialog}
            onOpenChange={setShowAdjustmentDialog}
            products={products}
            onSubmit={async (data) => {
              // Handle adjustment submission
              const res = await fetch('/api/inventory', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...workspaceSlugHeaders(params.company),
                },
                body: JSON.stringify(data),
              })
              if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: typeof err.error === 'string' ? err.error : 'Failed to update inventory',
                })
              } else {
                toast({ title: "Success", description: "Inventory updated successfully" })
              }
              fetchProducts()
            }}
          />
        </Card>
        <AlertsPanel />
      </div>
    </div>
  )
}
