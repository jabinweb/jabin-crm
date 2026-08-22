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

  const { data: items, isLoading } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['roadmap-items'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <SupportBackLink />
        <div>
          <h1 className="text-2xl font-bold">Product roadmap</h1>
          <p className="text-sm text-muted-foreground">
            Public feature requests and status
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
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
            <Label htmlFor="pub">Published</Label>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!title || createMutation.isPending}
          >
            Add
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
          ) : (
            items?.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm">{item.title}</p>
                  <Badge variant="secondary">{item.status}</Badge>
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
                  {item._count?.votes ?? 0} votes
                </p>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={item.status}
                    onValueChange={(v) =>
                      patchMutation.mutate({ id: item.id, status: v })
                    }
                  >
                    <SelectTrigger className="h-8 w-[140px]">
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
          {!isLoading && !items?.length ? (
            <p className="text-sm text-muted-foreground">No roadmap items yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
