'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, History, SlidersHorizontal } from 'lucide-react'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from '@/hooks/use-toast'
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog"
import { TransactionHistoryDialog } from "@/components/inventory/transaction-history-dialog"
import { AlertsPanel } from "@/components/inventory/alerts-panel"

export default function StockAdjustmentPage() {
  const params = useParams<{ company: string }>()
  const { path } = useWorkspacePaths()
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory', {
        headers: workspaceSlugHeaders(params.company),
      })
      if (response.ok) {
        const data = await response.json()
        setProducts(data?.data?.products ?? [])
        setTransactions(
          (data?.data?.inventory ?? []).map((item: any) => ({
            ...item,
            product: item.product ?? item.Product,
          }))
        )
      } else {
        toast({
          variant: "destructive",
          title: "Couldn't load products",
          description: "Refresh the page to try again.",
        })
      }
    } finally {
      setLoaded(true)
    }
  }, [params.company])

  useEffect(() => {
    if (params.company) void fetchProducts()
  }, [params.company, fetchProducts])

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-3 mb-2" asChild>
          <Link href={path('/dashboard/inventory')}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Inventory
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Stock adjustment</h1>
        <p className="text-sm text-muted-foreground">
          Correct stock counts after a stocktake, damage, or loss, and keep an eye on low-stock alerts.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="min-w-0 space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-muted p-2 text-muted-foreground">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">Adjust stock</h2>
              <p className="text-sm text-muted-foreground">
                Add or remove units for a product. Every adjustment is recorded with a reason in the
                transaction history.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowAdjustmentDialog(true)}
              disabled={!loaded || products.length === 0}
            >
              Adjust stock
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowHistoryDialog(true)}
              disabled={!loaded}
            >
              <History className="mr-2 h-4 w-4" />
              Transaction history
            </Button>
          </div>
          {loaded && products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products to adjust yet.{' '}
              <Link
                href={path('/dashboard/products/new')}
                className="text-primary underline underline-offset-2"
              >
                Add a product
              </Link>{' '}
              first.
            </p>
          ) : null}
          <StockAdjustmentDialog
            open={showAdjustmentDialog}
            onOpenChange={setShowAdjustmentDialog}
            products={products}
            onSubmit={async (data) => {
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
                  title: "Couldn't update stock",
                  description: typeof err.error === 'string' ? err.error : 'Please try again.',
                })
              } else {
                toast({ title: "Stock updated", description: "The adjustment has been recorded." })
              }
              void fetchProducts()
            }}
          />
          <TransactionHistoryDialog
            open={showHistoryDialog}
            onOpenChange={setShowHistoryDialog}
            transactions={transactions}
          />
        </Card>
        <AlertsPanel />
      </div>
    </div>
  )
}
