'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const DEFAULT_BODY = `To whom it may concern,

This is to certify that {{name}} ({{employeeId}}) is employed with us as {{jobTitle}} in the {{department}} department.

Date: {{date}}`

export default function LettersPage() {
  const qc = useQueryClient()
  const [tplName, setTplName] = useState('Experience letter')
  const [tplBody, setTplBody] = useState(DEFAULT_BODY)
  const [employeeId, setEmployeeId] = useState('')
  const [templateId, setTemplateId] = useState('')

  const { data } = useQuery({
    queryKey: ['hr-letters'],
    queryFn: async () => {
      const res = await fetch('/api/hr/letters')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{
        templates: { id: string; name: string; body: string; type: string }[]
        letters: {
          id: string
          title: string
          body: string
          issuedAt: string
          employee: { name: string; employeeId: string }
        }[]
      }>
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-directory-letters'],
    queryFn: async () => {
      const res = await fetch('/api/hr/directory')
      if (!res.ok) return []
      return (await res.json()) as { id: string; name: string; employeeId: string }[]
    },
  })

  const createTpl = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_template', name: tplName, body: tplBody }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Template saved')
      void qc.invalidateQueries({ queryKey: ['hr-letters'] })
    },
  })

  const issue = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue', employeeId, templateId }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Letter issued')
      void qc.invalidateQueries({ queryKey: ['hr-letters'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">HR letters</h1>
        <p className="text-sm text-muted-foreground">
          Templates with {'{{name}}'}, {'{{employeeId}}'}, {'{{jobTitle}}'}, {'{{department}}'},{' '}
          {'{{date}}'}.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
          <Textarea rows={8} value={tplBody} onChange={(e) => setTplBody(e.target.value)} />
          <Button onClick={() => createTpl.mutate()} disabled={createTpl.isPending}>
            Save template
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue letter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label>Employee</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <Label>Template</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Select…</option>
              {(data?.templates || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={!employeeId || !templateId || issue.isPending}
            onClick={() => issue.mutate()}
          >
            Issue
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issued</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.letters || []).map((l) => (
            <div key={l.id} className="rounded-lg border p-3">
              <p className="font-medium">
                {l.title} — {l.employee.name}
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{l.body}</pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
