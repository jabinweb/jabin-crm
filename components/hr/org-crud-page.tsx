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
import { QueryErrorState } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'

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
  const singularLower = title.toLowerCase().replace(/s$/, '')
  const singular = singularLower.charAt(0).toUpperCase() + singularLower.slice(1)
  const fieldId = (f: string) => `${queryKey}-${f}`
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [level, setLevel] = useState('')

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
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
          name: name.trim(),
          code: code.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          level: level ? Number(level) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Couldn’t add ${singularLower}`)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(`${singular} added`)
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
        throw new Error(err.error || `Couldn’t remove ${singularLower}`)
      }
    },
    onSuccess: () => {
      toast.success(`${singular} removed`)
      void queryClient.invalidateQueries({ queryKey: [queryKey] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add {singularLower}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim() && !createMutation.isPending) createMutation.mutate()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor={fieldId('name')}>Name</Label>
                <Input id={fieldId('name')} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {fields.includes('code') && (
                <div className="space-y-2">
                  <Label htmlFor={fieldId('code')}>Code (optional)</Label>
                  <Input id={fieldId('code')} value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
              )}
              {fields.includes('level') && (
                <div className="space-y-2">
                  <Label htmlFor={fieldId('level')}>Level (optional)</Label>
                  <Input
                    id={fieldId('level')}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  />
                </div>
              )}
              {fields.includes('city') && (
                <div className="space-y-2">
                  <Label htmlFor={fieldId('city')}>City (optional)</Label>
                  <Input
                    id={fieldId('city')}
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              )}
              {fields.includes('address') && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={fieldId('address')}>Address (optional)</Label>
                  <Input
                    id={fieldId('address')}
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {singularLower}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <CardListSkeleton rows={4} />
          ) : isError ? (
            <QueryErrorState
              title={`Couldn’t load ${title.toLowerCase()}`}
              onRetry={() => void refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={`No ${title.toLowerCase()} yet`}
              description={`Use the form above to add your first ${singularLower}, then assign it on employee profiles.`}
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[row.code, row.city, row.level != null ? `Level ${row.level}` : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Remove ${row.name}`}
                    disabled={deleteMutation.isPending && deleteMutation.variables === row.id}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: `Remove ${singularLower}?`,
                        description: `“${row.name}” will be permanently deleted. This can’t be undone.`,
                        confirmLabel: 'Remove',
                        variant: 'destructive',
                      })
                      if (ok) deleteMutation.mutate(row.id)
                    }}
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
