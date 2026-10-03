'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/ui/empty-state"
import { FullTableSkeleton } from '@/components/loading'
import { AlertTriangle, ChevronLeft, ClipboardList, Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'

type Batch = {
  id: string
  batchNumber: string
  serialNumber?: string | null
  quantity: number
  expiryDate?: string | null
  product?: { id: string; name: string; sku?: string | null } | null
  location?: { id: string; name: string } | null
}

type Option = { id: string; name: string }

function formatExpiry(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy')
}

export default function BatchesPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths()
  const queryClient = useQueryClient()
  // Batch creation needs inventory:write (admins by default); others get a read-only list
  const { data: session } = useSession()
  const canWrite = ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    productId: '',
    locationId: '',
    batchNumber: '',
    serialNumber: '',
    quantity: '',
    expiryDate: '',
  })

  const { data: batches = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory-batches', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/inventory/batch')
      if (!res.ok) throw new Error('Failed to load batches')
      const body = await res.json()
      return (body?.data ?? []) as Batch[]
    },
    enabled: !!slug,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['batch-products', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/products')
      if (!res.ok) return []
      const body = await res.json()
      return (Array.isArray(body) ? body : body?.products ?? []) as Option[]
    },
    enabled: !!slug && canWrite && dialogOpen,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/locations')
      if (!res.ok) return []
      return (await res.json()) as Option[]
    },
    enabled: !!slug && canWrite && dialogOpen,
  })

  const resetForm = () =>
    setForm({ productId: '', locationId: '', batchNumber: '', serialNumber: '', quantity: '', expiryDate: '' })

  const quantityNumber = Number(form.quantity)
  const quantityValid = Number.isInteger(quantityNumber) && quantityNumber > 0
  const canSubmit =
    !!form.productId && !!form.locationId && !!form.batchNumber.trim() && quantityValid

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/inventory/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          locationId: form.locationId,
          batchNumber: form.batchNumber.trim(),
          serialNumber: form.serialNumber.trim() || undefined,
          quantity: quantityNumber,
          expiryDate: form.expiryDate || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to create batch')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Batch created')
      resetForm()
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['inventory-batches', slug] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const q = searchQuery.trim().toLowerCase()
  const filteredBatches = batches.filter((batch) =>
    !q ||
    batch.batchNumber.toLowerCase().includes(q) ||
    (batch.serialNumber ?? '').toLowerCase().includes(q) ||
    (batch.product?.name ?? '').toLowerCase().includes(q)
  )

  return (
    <div className="space-y-6">
      <div>
      <Button variant="ghost" size="sm" className="-ml-3 mb-2" asChild>
        <Link href={path('/dashboard/inventory')}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Inventory
        </Link>
      </Button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground">
            Track stock by batch or lot number, with where it is held and when it expires.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New batch
          </Button>
        ) : null}
      </div>
      </div>

      <Card className="min-w-0 space-y-4 p-4 sm:p-6">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search batches"
            placeholder="Search batch, serial, or product"
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <FullTableSkeleton columnCount={6} rowCount={5} className="border-0" />
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load batches"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
          />
        ) : batches.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No batches yet"
            description="Record a batch to track lot numbers, quantities, and expiry dates per location."
            actionLabel={canWrite ? 'New batch' : undefined}
            onAction={canWrite ? () => setDialogOpen(true) : undefined}
          />
        ) : filteredBatches.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No batches match your search"
            actionLabel="Clear search"
            onAction={() => setSearchQuery('')}
          />
        ) : (
          <>
            <div className="divide-y rounded-md border md:hidden">
              {filteredBatches.map((batch) => (
                <div key={batch.id} className="space-y-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium">{batch.product?.name ?? 'Unknown product'}</p>
                    <span className="shrink-0 text-sm tabular-nums">Qty {batch.quantity}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    Batch <span className="font-mono">{batch.batchNumber}</span>
                    {batch.serialNumber ? <> · SN <span className="font-mono">{batch.serialNumber}</span></> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {batch.location?.name ?? '—'} · Expires {formatExpiry(batch.expiryDate)}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono text-sm">{batch.batchNumber}</TableCell>
                      <TableCell className="font-medium">{batch.product?.name ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{batch.serialNumber || '—'}</TableCell>
                      <TableCell>{batch.location?.name ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{batch.quantity}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatExpiry(batch.expiryDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New batch</DialogTitle>
            <DialogDescription>Record a batch or lot of a product held at one location.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="batch-product">Product</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                <SelectTrigger id="batch-product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="batch-location">Location</Label>
              <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
                <SelectTrigger id="batch-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No locations yet —{' '}
                  <Link
                    href={path('/dashboard/inventory/locations')}
                    className="text-primary underline underline-offset-2"
                  >
                    add one first
                  </Link>
                  .
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-number">Batch / lot number</Label>
              <Input
                id="batch-number"
                value={form.batchNumber}
                onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-qty">Quantity</Label>
              <Input
                id="batch-qty"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                aria-invalid={(form.quantity !== '' && !quantityValid) || undefined}
              />
              {form.quantity !== '' && !quantityValid ? (
                <p className="text-xs text-destructive">Enter a whole number greater than 0.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-serial">Serial number (optional)</Label>
              <Input
                id="batch-serial"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-expiry">Expiry date (optional)</Label>
              <Input
                id="batch-expiry"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
