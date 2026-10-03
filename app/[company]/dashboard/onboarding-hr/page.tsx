'use client'

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState, StatusBadge, ensureOk } from '@/components/hr/hr-ui'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Emp = { id: string; name: string; employeeId: string }

type OnboardingData = {
  templates: { id: string; name: string }[]
  checklists: {
    id: string
    status: string
    items: { title: string; done: boolean }[]
    employee: { name: string; employeeId: string }
  }[]
}

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm'

export default function OnboardingAdminPage() {
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['hr-onboarding'],
    queryFn: async () => {
      const res = await fetch('/api/hr/onboarding')
      await ensureOk(res, 'Failed to load onboarding')
      return res.json() as Promise<OnboardingData>
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-directory-pick'],
    queryFn: async () => {
      const res = await fetch('/api/hr/directory')
      if (!res.ok) return []
      return (await res.json()) as Emp[]
    },
  })

  const q = search.trim().toLowerCase()
  const filtered = employees.filter(
    (e) => !q || e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q)
  )

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', employeeId, templateId: templateId || undefined }),
      })
      await ensureOk(res, 'Could not start onboarding')
    },
    onSuccess: () => {
      const name = employees.find((e) => e.id === employeeId)?.name
      toast.success(name ? `Onboarding started for ${name}` : 'Onboarding started', {
        description: 'A welcome email is sent if email is set up for this workspace.',
      })
      setEmployeeId('')
      setSearch('')
      void qc.invalidateQueries({ queryKey: ['hr-onboarding'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleItem = useMutation({
    mutationFn: async ({ checklistId, index }: { checklistId: string; index: number }) => {
      const res = await fetch('/api/hr/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_item', checklistId, index }),
      })
      await ensureOk(res, 'Could not update the checklist')
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr-onboarding'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const templates = data?.templates ?? []
  const checklists = data?.checklists ?? []

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (employeeId && !start.isPending) start.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Give new hires a checklist and track it until they’re fully set up.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a checklist</CardTitle>
          <CardDescription>Pick a new hire to create their checklist from your onboarding template.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="onb-search">Find employee</Label>
                <Input
                  id="onb-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or employee ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onb-employee">Employee</Label>
                <select
                  id="onb-employee"
                  className={SELECT_CLASS}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">
                    {filtered.length === 0 ? 'No matching employees' : 'Select employee'}
                  </option>
                  {filtered.slice(0, 80).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.employeeId})
                    </option>
                  ))}
                </select>
                {filtered.length > 80 && (
                  <p className="text-xs text-muted-foreground">
                    Showing the first 80 of {filtered.length}. Search to narrow the list.
                  </p>
                )}
              </div>
              {templates.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="onb-template">Checklist template</Label>
                  <select
                    id="onb-template"
                    className={SELECT_CLASS}
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">Default</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={!employeeId || start.isPending}>
              {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start onboarding
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load checklists" onRetry={() => void refetch()} />
          ) : checklists.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No onboarding checklists yet"
              description="Start a checklist for a new hire using the form above."
            />
          ) : (
            checklists.map((c) => {
              const items = c.items || []
              const done = items.filter((i) => i.done).length
              const busy = toggleItem.isPending && toggleItem.variables?.checklistId === c.id
              return (
                <div key={c.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {c.employee.name}{' '}
                        <span className="text-xs text-muted-foreground">({c.employee.employeeId})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {done} of {items.length} done
                      </p>
                    </div>
                    <StatusBadge status={c.status} className="self-start" />
                  </div>
                  <fieldset className="space-y-1" disabled={busy}>
                    <legend className="sr-only">Checklist for {c.employee.name}</legend>
                    {items.map((item, index) => (
                      <label
                        key={index}
                        className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={item.done}
                          onChange={() => toggleItem.mutate({ checklistId: c.id, index })}
                        />
                        <span className={item.done ? 'text-muted-foreground line-through' : undefined}>
                          {item.title}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
