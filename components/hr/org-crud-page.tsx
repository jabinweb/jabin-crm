'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { Loader2, Trash2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { CardListSkeleton } from '@/components/loading'

type OrgRow = {
  id: string
  name: string
  code?: string | null
  city?: string | null
  address?: string | null
  level?: number | null
  active: boolean
}

type Props = {
  title: string
  description: string
  apiPath: string
  queryKey: string
  icon: LucideIcon
  fields?: Array<'code' | 'city' | 'address' | 'level'>
}

export function HrOrgCrudPage({
  title,
  description,
  apiPath,
  queryKey,
  icon: Icon,
  fields = ['code'],
}: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [level, setLevel] = useState('')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await fetch(apiPath)
      if (!res.ok) throw new Error('Failed to load')
      return (await res.json()) as OrgRow[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code || undefined,
          city: city || undefined,
          address: address || undefined,
          level: level ? Number(level) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Created')
      setName('')
      setCode('')
      setCity('')
      setAddress('')
      setLevel('')
      void queryClient.invalidateQueries({ queryKey: [queryKey] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiPath}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete')
      }
    },
    onSuccess: () => {
      toast.success('Removed')
      void queryClient.invalidateQueries({ queryKey: [queryKey] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add {title.toLowerCase().replace(/s$/, '')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {fields.includes('code') && (
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
            )}
            {fields.includes('level') && (
              <div className="space-y-2">
                <Label>Level</Label>
                <Input
                  type="number"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                />
              </div>
            )}
            {fields.includes('city') && (
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            )}
            {fields.includes('address') && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            )}
          </div>
          <Button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <CardListSkeleton rows={4} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={`No ${title.toLowerCase()} yet`}
              description="Add items to assign them on employee profiles."
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[row.code, row.city, row.level != null ? `L${row.level}` : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(row.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
