'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type Emp = { id: string; name: string; employeeId: string }

export default function OnboardingAdminPage() {
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [templateName, setTemplateName] = useState('Default onboarding')
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: ['hr-onboarding'],
    queryFn: async () => {
      const res = await fetch('/api/hr/onboarding')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{
        templates: { id: string; name: string }[]
        checklists: {
          id: string
          status: string
          items: { title: string; done: boolean }[]
          employee: { name: string; employeeId: string }
        }[]
      }>
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

  const filtered = employees.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase())
  )

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', employeeId }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Onboarding started (welcome email sent if mail configured)')
      void qc.invalidateQueries({ queryKey: ['hr-onboarding'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <p className="text-sm text-muted-foreground">Digital checklists for new hires.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Search employee</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or EMP-…"
            />
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select employee…</option>
              {filtered.slice(0, 80).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!employeeId || start.isPending} onClick={() => start.mutate()}>
              Start
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await fetch('/api/hr/onboarding', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'create_template', name: templateName }),
                })
                toast.success('Template saved')
                void qc.invalidateQueries({ queryKey: ['hr-onboarding'] })
              }}
            >
              Ensure template
            </Button>
            <Input
              className="max-w-xs"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active checklists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.checklists?.map((c) => (
            <div key={c.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex justify-between">
                <p className="font-medium">
                  {c.employee.name}{' '}
                  <span className="text-xs text-muted-foreground">
                    ({c.employee.employeeId})
                  </span>
                </p>
                <Badge>{c.status}</Badge>
              </div>
              <div className="space-y-1">
                {(c.items || []).map((item, index) => (
                  <label key={index} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={async () => {
                        await fetch('/api/hr/onboarding', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'toggle_item',
                            checklistId: c.id,
                            index,
                          }),
                        })
                        void qc.invalidateQueries({ queryKey: ['hr-onboarding'] })
                      }}
                    />
                    {item.title}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
