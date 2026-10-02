'use client'

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, ensureOk, humanizeEnum } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'
import { ExternalLink, FileText, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type PolicyDoc = { id: string; title: string; fileUrl: string; category: string }

export default function HrPoliciesPage() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [fileUrl, setFileUrl] = useState('')

  const {
    data: docs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['hr-policies'],
    queryFn: async () => {
      const res = await fetch('/api/hr/policies?admin=1')
      await ensureOk(res, 'Failed to load policies')
      return res.json() as Promise<PolicyDoc[]>
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), fileUrl: fileUrl.trim() }),
      })
      await ensureOk(res, 'Could not add the policy')
    },
    onSuccess: () => {
      toast.success('Policy added')
      setTitle('')
      setFileUrl('')
      void qc.invalidateQueries({ queryKey: ['hr-policies'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hr/policies?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await ensureOk(res, 'Could not remove the policy')
    },
    onSuccess: () => {
      toast.success('Policy removed')
      void qc.invalidateQueries({ queryKey: ['hr-policies'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const urlValid = /^https?:\/\/\S+$/i.test(fileUrl.trim())
  const canSave = title.trim().length > 0 && urlValid && !create.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (canSave) create.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Policy library</h1>
        <p className="text-sm text-muted-foreground">
          Handbooks and HR policy documents employees can open from their portal.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add policy</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="policy-title">Title</Label>
              <Input
                id="policy-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Employee handbook 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-url">Document link</Label>
              <Input
                id="policy-url"
                type="url"
                inputMode="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://…"
                aria-invalid={fileUrl.length > 0 && !urlValid}
              />
              {fileUrl.length > 0 && !urlValid && (
                <p className="text-xs text-destructive">Enter a full link starting with https://</p>
              )}
            </div>
            <div className="flex items-start sm:pt-8">
              <Button type="submit" className="w-full sm:w-auto" disabled={!canSave}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add policy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load policies" onRetry={() => void refetch()} />
          ) : docs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No policies yet"
              description="Add a title and a link to your handbook or policy PDF above."
            />
          ) : (
            docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{humanizeEnum(d.category)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild variant="outline" size="sm" className="h-9">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
                      Open
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${d.title}`}
                    disabled={remove.isPending && remove.variables === d.id}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'Remove this policy?',
                        description: `“${d.title}” will no longer be visible to employees.`,
                        confirmLabel: 'Remove',
                        variant: 'destructive',
                      })
                      if (ok) remove.mutate(d.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
