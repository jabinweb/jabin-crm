'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function HrPoliciesPage() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [fileUrl, setFileUrl] = useState('')

  const { data: docs = [] } = useQuery({
    queryKey: ['hr-policies'],
    queryFn: async () => {
      const res = await fetch('/api/hr/policies?admin=1')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ id: string; title: string; fileUrl: string; category: string }[]>
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Policy library</h1>
        <p className="text-sm text-muted-foreground">Handbooks and HR policy PDFs.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add policy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>File URL</Label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              disabled={!title || !fileUrl}
              onClick={async () => {
                const res = await fetch('/api/hr/policies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title, fileUrl }),
                })
                if (!res.ok) toast.error('Failed')
                else {
                  toast.success('Added')
                  setTitle('')
                  setFileUrl('')
                  void qc.invalidateQueries({ queryKey: ['hr-policies'] })
                }
              }}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 pt-6">
          {docs.map((d) => (
            <div key={d.id} className="flex justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">{d.category}</p>
              </div>
              <a className="text-sm underline" href={d.fileUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
