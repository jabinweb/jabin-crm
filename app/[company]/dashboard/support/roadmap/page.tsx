'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { SupportBackLink } from '@/components/support/support-back-link'
import { CardListSkeleton } from '@/components/loading'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { EmptyState } from '@/components/ui/empty-state'
import { AlertTriangle, Loader2, Map as MapIcon } from 'lucide-react'
import { humanizeEnum } from '@/lib/humanize-enum'

const STATUS_LABELS: Record<string, string> = {
  considering: 'Considering',
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  wont_do: "Won't do",
}

type RoadmapItem = {
  id: string
  title: string
  description?: string | null
  status: string
  published: boolean
  _count?: { votes: number }
}

export default function RoadmapPage() {
  const queryClient = useQueryClient()
  const { slug, workspaceFetch } = useWorkspacePaths()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('considering')
  const [published, setPublished] = useState(true)

  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['roadmap-items', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/roadmap')
      if (!res.ok) throw new Error('Failed to load')
      return res.json() as Promise<RoadmapItem[]>
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          status,
          published,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Roadmap item added')
      setTitle('')
      setDescription('')
      queryClient.invalidateQueries({ queryKey: ['roadmap-items'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await workspaceFetch('/api/roadmap', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Roadmap item updated')
      queryClient.invalidateQueries({ queryKey: ['roadmap-items'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col items-start">
        <SupportBackLink />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Product roadmap</h1>
          <p className="text-sm text-muted-foreground">
            Share what you are building and let customers vote on what matters.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="rm-title">Title</Label>
            <Input id="rm-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rm-description">Description (optional)</Label>
            <Textarea
              id="rm-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="rm-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="rm-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="considering">Considering</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={published}
              onCheckedChange={setPublished}
              id="pub"
            />
            <Label htmlFor="pub">Visible to customers</Label>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load the roadmap"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : (
            items?.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm">{item.title}</p>
                  <Badge variant="secondary">{STATUS_LABELS[item.status] ?? humanizeEnum(item.status)}</Badge>
                  {!item.published ? (
                    <Badge variant="outline">Draft</Badge>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  {item._count?.votes ?? 0} vote{(item._count?.votes ?? 0) === 1 ? '' : 's'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={item.status}
                    onValueChange={(v) =>
                      patchMutation.mutate({ id: item.id, status: v })
                    }
                  >
                    <SelectTrigger className="h-10 w-[150px] sm:h-8" aria-label={`Status for ${item.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="considering">Considering</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="wont_do">Won&apos;t do</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patchMutation.mutate({
                        id: item.id,
                        published: !item.published,
                      })
                    }
                  >
                    {item.published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      patchMutation.mutate({ id: item.id, action: 'vote' })
                    }
                  >
                    Vote
                  </Button>
                </div>
              </div>
            ))
          )}
          {!isLoading && !isError && !items?.length ? (
            <EmptyState
              icon={MapIcon}
              title="No roadmap items yet"
              description="Add your first item above to show customers what is coming next."
              className="py-8"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
