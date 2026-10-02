'use client'

import { useSession } from 'next-auth/react'

import { useEffect, useState, use, useCallback } from 'react'
import { useParams as useRouteParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft, Pencil, Trash, Package, Calendar, Barcode, RefreshCw, SearchX } from "lucide-react"
import { format } from 'date-fns'
import { useCurrency } from '@/hooks/use-currency'
import { humanizeEnum } from '@/lib/crm/humanize-enum'
import { DashboardLink } from '@/components/navigation/dashboard-link'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { InventoryManagement } from "@/components/inventory/inventory-management"
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { DetailSkeleton } from '@/components/loading'

interface Product {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  quantity: number
  sku: string | null
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const routeParams = useRouteParams<{ company: string }>()
  const { path, slug } = useWorkspacePaths()
  // Edit/delete are admin-only in the product API
  const { data: session } = useSession()
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role ?? '')

  const resolvedParams = use(params)
  const productId = resolvedParams.id

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { formatCurrency } = useCurrency()

  const fetchProduct = useCallback(async () => {
    setLoadError(false)
    try {
      const response = await fetch(`/api/products/${productId}`, {
        credentials: 'include',
      })

      if (response.status === 404) {
        setProduct(null)
        return
      }
      if (!response.ok) {
        throw new Error('Failed to fetch product')
      }

      const data = await response.json()
      setProduct(data)
    } catch {
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [productId])
  
  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId, fetchProduct]) // Now it's safe to include fetchProduct
  

  const handleDelete = async (e?: React.MouseEvent) => {
    // Keep the dialog open (and the button disabled) until the request finishes.
    e?.preventDefault()
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: workspaceSlugHeaders(slug ?? routeParams.company),
      })

      if (!response.ok) {
        throw new Error('Failed to delete product')
      }

      toast({
        title: "Success",
        description: "Product deleted"
      })
      setShowDeleteDialog(false)
      router.push(path('/dashboard/products'))
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete product"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-base font-semibold">We couldn&apos;t load this product</p>
        <p className="max-w-sm text-sm text-muted-foreground">Check your connection and try again.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild>
            <DashboardLink href="/dashboard/products">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to products
            </DashboardLink>
          </Button>
          <Button
            onClick={() => {
              setIsLoading(true)
              void fetchProduct()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <SearchX className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold">Product not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted or you may not have access to it.
        </p>
        <Button asChild className="mt-2">
          <DashboardLink href="/dashboard/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to products
          </DashboardLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
          <Button variant="ghost" asChild className="-ml-3">
            <DashboardLink href="/dashboard/products">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to products
            </DashboardLink>
          </Button>
          {product.category ? (
            <Badge variant="outline" className="text-sm">
              {humanizeEnum(product.category)}
            </Badge>
          ) : null}
        </div>
        <div className={isAdmin ? 'flex flex-wrap gap-2' : 'hidden'}>
          <Button
            variant="outline"
            onClick={() => router.push(path(`/dashboard/products/${product.id}/edit`))}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="relative aspect-square rounded-lg overflow-hidden border">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Package className="h-20 w-20 text-muted-foreground" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {product.description || 'No description yet.'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h1 className="break-words text-2xl font-semibold tracking-tight mb-2">{product.name}</h1>
              <div className="flex items-center gap-2 mb-4">
                {product.price != null ? (
                  <span className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(product.price)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">No price set</span>
                )}
              </div>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">SKU</span>
                  </div>
                  <span className="min-w-0 truncate font-medium">{product.sku || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Stock</span>
                  </div>
                  <Badge variant={product.quantity > 0 ? "default" : "destructive"}>
                    {product.quantity > 0 ? `${product.quantity} in stock` : "Out of stock"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Added</span>
                  </div>
                  <span className="font-medium">
                    {format(new Date(product.createdAt), 'd MMM yyyy')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryManagement productId={product.id} />
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product from your catalog. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 