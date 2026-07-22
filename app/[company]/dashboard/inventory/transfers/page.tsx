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
        title: "Success",
        description: "Stock transfer completed successfully"
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">Stock Transfer</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
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
              <Label htmlFor="sourceLocationId">Source Location</Label>
              <Select
                value={transfer.sourceLocationId ?? ''}
                onValueChange={(value) =>
                  setTransfer((prev) => ({ ...prev, sourceLocationId: value }))
                }
              >
                <SelectTrigger id="sourceLocationId">
                  <SelectValue placeholder="Select source location" />
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
              <Label htmlFor="targetLocationId">Target Location</Label>
              <Select
                value={transfer.targetLocationId ?? ''}
                onValueChange={(value) =>
                  setTransfer((prev) => ({ ...prev, targetLocationId: value }))
                }
              >
                <SelectTrigger id="targetLocationId">
                  <SelectValue placeholder="Select target location" />
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
                placeholder="Enter quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch Number (optional)</Label>
              <Input
                id="batchNumber"
                value={transfer.batchNumber ?? ''}
                onChange={(e) =>
                  setTransfer((prev) => ({
                    ...prev,
                    batchNumber: e.target.value || undefined,
                  }))
                }
                placeholder="Optional batch number"
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Processing..." : "Transfer Stock"}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Scan Product</h2>
          {showScanner ? (
            <BarcodeScanner
              onDetected={(result) => {
                setTransfer(prev => ({ ...prev, productId: result }))
                setShowScanner(false)
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
            <Button onClick={() => setShowScanner(true)} className="w-full">
              Start Scanner
            </Button>
          )}
          {transfer.productId && (
            <p className="mt-4 text-sm text-muted-foreground">
              Selected product ID: {transfer.productId}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
