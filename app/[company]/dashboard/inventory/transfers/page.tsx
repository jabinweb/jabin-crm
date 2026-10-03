'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { StockTransfer, Location, Product } from "@/types/inventory"
import { BarcodeScanner } from "@/components/inventory/barcode-scanner"
import Link from 'next/link'
import { ChevronLeft, Loader2, ScanLine } from 'lucide-react'

export default function StockTransferPage() {
  const params = useParams<{ company: string }>()
  const [isLoading, setIsLoading] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [products, setProducts] = useState<Pick<Product, 'id' | 'name' | 'sku'>[]>([])
  const [transfer, setTransfer] = useState<Partial<StockTransfer>>({})
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    if (params.company) {
      fetchLocations()
      fetchProducts()
    }
  }, [params.company])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations', {
        headers: workspaceSlugHeaders(params.company),
      })
      if (!response.ok) throw new Error('Failed to fetch locations')
      const data = await response.json()
      setLocations(Array.isArray(data) ? data : data.data ?? [])
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load locations"
      })
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products', {
        headers: workspaceSlugHeaders(params.company),
      })
      if (!response.ok) throw new Error('Failed to fetch products')
      const data = await response.json()
      setProducts(Array.isArray(data) ? data : data.data ?? [])
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load products"
      })
    }
  }

  const handleTransfer = async () => {
    if (
      !transfer.productId ||
      !transfer.sourceLocationId ||
      !transfer.targetLocationId ||
      !transfer.quantity
    ) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Product, source, target, and quantity are required",
      })
      return
    }

    if (transfer.sourceLocationId === transfer.targetLocationId) {
      toast({
        variant: "destructive",
        title: "Invalid locations",
        description: "Source and target locations must be different",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...workspaceSlugHeaders(params.company),
        },
        body: JSON.stringify({
          productId: transfer.productId,
          sourceLocationId: transfer.sourceLocationId,
          targetLocationId: transfer.targetLocationId,
          quantity: Number(transfer.quantity),
          batchNumber: transfer.batchNumber || undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Transfer failed')
      }

      toast({
        title: "Stock transferred",
        description: "The transfer has been recorded."
      })

      setTransfer({})
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete stock transfer"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === transfer.productId)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-3 -mb-4" asChild>
        <Link href={`/${params.company}/dashboard/inventory`}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Inventory
        </Link>
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Stock transfers</h1>
          <p className="text-sm text-muted-foreground">
            Move stock between warehouses, stores, and vans.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/${params.company}/dashboard/inventory/locations`}>Manage locations</Link>
        </Button>
      </div>
      {locations.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No locations yet.{' '}
          <Link
            className="underline text-primary"
            href={`/${params.company}/dashboard/inventory/locations`}
          >
            Create a warehouse or store
          </Link>{' '}
          before transferring stock.
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="min-w-0 p-6">
          <form onSubmit={(e) => { e.preventDefault(); handleTransfer(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productId">Product</Label>
              <Select
                value={transfer.productId ?? ''}
                onValueChange={(value) =>
                  setTransfer((prev) => ({ ...prev, productId: value }))
                }
              >
                <SelectTrigger id="productId">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceLocationId">From location</Label>
              <Select
                value={transfer.sourceLocationId ?? ''}
                onValueChange={(value) =>
                  setTransfer((prev) => ({ ...prev, sourceLocationId: value }))
                }
              >
                <SelectTrigger id="sourceLocationId">
                  <SelectValue placeholder="Select where stock is now" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLocationId">To location</Label>
              <Select
                value={transfer.targetLocationId ?? ''}
                onValueChange={(value) =>
                  setTransfer((prev) => ({ ...prev, targetLocationId: value }))
                }
              >
                <SelectTrigger id="targetLocationId">
                  <SelectValue placeholder="Select where it is going" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((l) => l.id !== transfer.sourceLocationId)
                    .map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                required
                value={transfer.quantity ?? ''}
                onChange={(e) =>
                  setTransfer((prev) => ({
                    ...prev,
                    quantity: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                inputMode="numeric"
                placeholder="Enter quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch number (optional)</Label>
              <Input
                id="batchNumber"
                value={transfer.batchNumber ?? ''}
                onChange={(e) =>
                  setTransfer((prev) => ({
                    ...prev,
                    batchNumber: e.target.value || undefined,
                  }))
                }
                placeholder="e.g. LOT-2026-04"
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring…
                </>
              ) : (
                "Transfer stock"
              )}
            </Button>
          </form>
        </Card>

        <Card className="min-w-0 p-6">
          <h2 className="text-lg font-semibold">Scan a product</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Use your camera to scan a product barcode or SKU instead of picking it from the list.
          </p>
          {showScanner ? (
            <BarcodeScanner
              onDetected={(result) => {
                const code = result.trim()
                const match = products.find(
                  (p) => p.id === code || (p.sku ?? '').toLowerCase() === code.toLowerCase()
                )
                setShowScanner(false)
                if (!match) {
                  toast({
                    variant: "destructive",
                    title: "Product not found",
                    description: `No product matches the scanned code “${code}”.`,
                  })
                  return
                }
                setTransfer(prev => ({ ...prev, productId: match.id }))
              }}
              onError={(error) => {
                toast({
                  variant: "destructive",
                  title: "Scanner Error",
                  description: error instanceof Error ? error.message : String(error)
                })
              }}
            />
          ) : (
            <Button variant="outline" onClick={() => setShowScanner(true)} className="w-full">
              <ScanLine className="mr-2 h-4 w-4" />
              Start scanner
            </Button>
          )}
          {selectedProduct && (
            <p className="mt-4 text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selectedProduct.name}</span>
              {selectedProduct.sku ? ` (${selectedProduct.sku})` : ''}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
