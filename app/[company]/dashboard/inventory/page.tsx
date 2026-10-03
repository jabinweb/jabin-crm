'use client'

import { useSession } from 'next-auth/react'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { useCurrency } from '@/hooks/use-currency'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import Link from 'next/link'
import { Search, Package, Plus, History, AlertTriangle, TrendingDown, TrendingUp, ArrowLeftRight, ClipboardList, Box, Truck, MapPin, Wallet } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog"
import { TransactionHistoryDialog } from "@/components/inventory/transaction-history-dialog"
import { FullTableSkeleton } from '@/components/loading'
import { toast } from '@/hooks/use-toast'
import type { Product } from '@/types/inventory'

interface StockLevel extends Pick<Product, 'id' | 'name' | 'sku' | 'quantity' | 'price' | 'minQuantity' | 'maxQuantity'> {
  _count: {
    Inventory: number
  },
  stockStatus: {
    isLowStock: boolean,
    isOverStock: boolean,
  }
}

interface InventoryTransaction {
  id: string
  type: "IN" | "OUT" // Fixed to match dialog expectations
  quantity: number
  price: number
  reason: string
  notes?: string
  createdAt: string
  product: Pick<Product, 'id' | 'name' | 'sku'>
}

interface InventoryData {
  data: {
    products: StockLevel[]
    inventory: InventoryTransaction[]
  }
}

function stockLabel(product: StockLevel) {
  if (product.stockStatus.isLowStock) return 'Low stock'
  if (product.stockStatus.isOverStock) return 'Overstock'
  return 'In stock'
}

function stockVariant(product: StockLevel): 'destructive' | 'outline' | 'secondary' {
  if (product.stockStatus.isLowStock) return 'destructive'
  if (product.stockStatus.isOverStock) return 'outline'
  return 'secondary'
}

export default function InventoryPage() {
  const router = useRouter()
  const params = useParams<{ company: string }>()
  const { path } = useWorkspacePaths()
  const { formatCurrency } = useCurrency()
  // Stock writes need inventory:write (admins by default); others get a read-only view
  const { data: session } = useSession()
  const canWriteStock = ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role ?? '')
  const [inventoryData, setInventoryData] = useState<InventoryData>({
    data: {
      products: [],
      inventory: []
    }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)

  const fetchInventory = useCallback(async () => {
    try {
      setLoadError(false)
      const response = await fetch('/api/inventory', {
        headers: workspaceSlugHeaders(params.company),
      })
      if (!response.ok) throw new Error('Failed to fetch inventory')

      const data = await response.json()

      // Transform the data to match our interface expectations
      const transformedData = {
        data: {
          products: data.data.products.map((product: any) => ({
            ...product,
            stockStatus: {
              isLowStock: product.quantity <= product.minQuantity,
              isOverStock: product.maxQuantity ? product.quantity >= product.maxQuantity : false
            }
          })),
          inventory: data.data.inventory.map((item: any) => ({
            ...item,
            type: item.type as "IN" | "OUT", // Ensure type is correctly cast
            product: item.product ?? item.Product
          }))
        }
      }

      setInventoryData(transformedData)
    } catch {
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [params.company])

  useEffect(() => {
    if (params.company) void fetchInventory()
  }, [params.company, fetchInventory])

  const retry = () => {
    setIsLoading(true)
    void fetchInventory()
  }

  const filteredStockLevels = inventoryData.data.products?.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.sku ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const handleStockAdjustment = async (data: {
    productId: string
    type: 'IN' | 'OUT'
    quantity: number
    reason: string
    notes?: string
  }) => {
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...workspaceSlugHeaders(params.company),
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to update inventory')

      toast({
        title: "Stock updated",
        description: "The adjustment has been recorded."
      })

      fetchInventory()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't update stock",
        description: "Please try again."
      })
      throw error // Re-throw to be handled by the dialog
    }
  }

  const stats = {
    totalProducts: inventoryData.data.products.length,
    totalValue: inventoryData.data.products.reduce((acc, p) => acc + ((p.price ?? 0) * p.quantity), 0),
    lowStock: inventoryData.data.products.filter(p => p.stockStatus.isLowStock).length,
    overStock: inventoryData.data.products.filter(p => p.stockStatus.isOverStock).length
  }

  const statCards = [
    { label: 'Products', value: String(stats.totalProducts), icon: Package },
    { label: 'Low stock', value: String(stats.lowStock), icon: TrendingDown },
    { label: 'Overstock', value: String(stats.overStock), icon: TrendingUp },
    { label: 'Stock value', value: formatCurrency(stats.totalValue), icon: Wallet },
  ]

  const hasProducts = inventoryData.data.products.length > 0
  const emptyState = loadError ? (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load inventory"
      description="Check your connection and try again."
      actionLabel="Try again"
      onAction={retry}
    />
  ) : !hasProducts ? (
    <EmptyState
      icon={Package}
      title="No products in inventory yet"
      description="Add products to your catalog to start tracking stock levels and movements."
      actionLabel="Add product"
      actionHref={path('/dashboard/products/new')}
    />
  ) : (
    <EmptyState
      icon={Search}
      title="No products match your search"
      description="Try a different product name or SKU."
      actionLabel="Clear search"
      onAction={() => setSearchQuery('')}
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock levels, value, and movements across your product catalog.
          </p>
        </div>
        <div className={canWriteStock ? 'flex flex-wrap gap-2' : 'hidden'}>
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/inventory/stock-adjustment')}>
              <Box className="h-4 w-4 mr-2" />
              Stock adjustment
            </Link>
          </Button>
          <Button onClick={() => setShowAdjustmentDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Quick adjust
          </Button>
        </div>
      </div>

      <nav aria-label="Inventory sections" className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={path('/dashboard/inventory/batches')}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Batches
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={path('/dashboard/inventory/locations')}>
            <MapPin className="h-4 w-4 mr-2" />
            Locations
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className={canWriteStock ? undefined : 'hidden'}>
          <Link href={path('/dashboard/inventory/transfers')}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Transfers
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={path('/dashboard/demo-equipment')}>
            <Truck className="h-4 w-4 mr-2" />
            Demo fleet
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowHistoryDialog(true)} disabled={isLoading || loadError}>
          <History className="h-4 w-4 mr-2" />
          Transaction history
        </Button>
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="min-w-0 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <stat.icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">{stat.label}</span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-7 w-20" />
            ) : (
              <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">
                {loadError ? '—' : stat.value}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card className="min-w-0 p-4 sm:p-6 space-y-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search inventory"
            placeholder="Search by product name or SKU"
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loadError}
          />
        </div>

        {isLoading ? (
          <FullTableSkeleton columnCount={7} rowCount={6} className="border-0" />
        ) : loadError || filteredStockLevels.length === 0 ? (
          emptyState
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {filteredStockLevels.map((product) => (
                <Link
                  key={product.id}
                  href={path(`/dashboard/products/${product.id}`)}
                  className="block rounded-lg border bg-card p-3 active:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.sku || 'No SKU'} · {product._count.Inventory} movement{product._count.Inventory === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Badge className="shrink-0" variant={stockVariant(product)}>
                      {stockLabel(product)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm tabular-nums">
                    <span>Qty {product.quantity} × {formatCurrency(product.price ?? 0)}</span>
                    <span className="font-medium">{formatCurrency(product.quantity * (product.price ?? 0))}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Movements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStockLevels.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(path(`/dashboard/products/${product.id}`))}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={path(`/dashboard/products/${product.id}`)}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.sku || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{product.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(product.price ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(product.quantity * (product.price ?? 0))}</TableCell>
                      <TableCell>
                        <Badge variant={stockVariant(product)}>{stockLabel(product)}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{product._count.Inventory}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <StockAdjustmentDialog
        open={showAdjustmentDialog}
        onOpenChange={setShowAdjustmentDialog}
        products={inventoryData.data.products}
        onSubmit={handleStockAdjustment}
      />

      <TransactionHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        transactions={inventoryData.data.inventory}
      />
    </div>
  )
}
