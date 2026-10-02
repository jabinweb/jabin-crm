'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { Loader2, CalendarDays, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CardListSkeleton } from '@/components/loading'
import { format } from 'date-fns'
import { QueryErrorState, humanizeEnum } from '@/components/hr/hr-ui'
import { confirmAction } from '@/lib/confirm-action'

type Holiday = {
  id: string
  name: string
  date: string
  type: string
}

export default function HolidaysAdminPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState('PUBLIC')

  const {
    data: holidays = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-holidays'],
    queryFn: async () => {
      const res = await fetch('/api/holidays')
      if (!res.ok) throw new Error('Failed to load holidays')
      return (await res.json()) as Holiday[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, type }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Holiday added')
      setName('')
      setDate('')
      setType('PUBLIC')
      void queryClient.invalidateQueries({ queryKey: ['admin-holidays'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/holidays?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete')
      }
    },
    onSuccess: () => {
      toast.success('Holiday removed')
      void queryClient.invalidateQueries({ queryKey: ['admin-holidays'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Holidays</h1>
        <p className="text-sm text-muted-foreground">
          Company holidays shown on the employee leave calendar and home hub.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add holiday</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim() && date && !createMutation.isPending) createMutation.mutate()
            }}
          >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="hol-name">Name</Label>
              <Input
                id="hol-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Republic Day"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hol-date">Date</Label>
              <Input
                id="hol-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hol-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="hol-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="RESTRICTED">Restricted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={
              !name.trim() || !date || createMutation.isPending
            }
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add holiday
          </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holiday calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <CardListSkeleton rows={4} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load holidays" onRetry={() => void refetch()} />
          ) : holidays.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No holidays yet"
              description="Use the form above to add public or restricted holidays for your company."
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {holidays.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(h.date), 'EEE, d MMM yyyy')} · {humanizeEnum(h.type)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Remove ${h.name}`}
                    disabled={deleteMutation.isPending && deleteMutation.variables === h.id}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'Remove holiday?',
                        description: `“${h.name}” will be removed from the employee calendar.`,
                        confirmLabel: 'Remove',
                        variant: 'destructive',
                      })
                      if (ok) deleteMutation.mutate(h.id)
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
