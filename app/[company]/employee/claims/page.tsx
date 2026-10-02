'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { EssPageHeader } from '@/components/employee/mobile/page-header'

export default function EmployeeClaimsPage() {
  const qc = useQueryClient()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const { data: claims = [] } = useQuery({
    queryKey: ['my-claims'],
    queryFn: async () => {
      const res = await fetch('/api/hr/claims')
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: tickets = [] } = useQuery({
    queryKey: ['my-hr-tickets'],
    queryFn: async () => {
      const res = await fetch('/api/hr/tickets')
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: policies = [] } = useQuery({
    queryKey: ['my-policies'],
    queryFn: async () => {
      const res = await fetch('/api/hr/policies')
      if (!res.ok) return []
      return res.json() as Promise<{ id: string; title: string; fileUrl: string }[]>
    },
  })

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Claims & HR help" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New expense claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            placeholder="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            className="w-full sm:w-auto"
            onClick={async () => {
              const res = await fetch('/api/hr/claims', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, amount: Number(amount) }),
              })
              if (!res.ok) toast.error('Failed')
              else {
                toast.success('Submitted')
                setDescription('')
                setAmount('')
                void qc.invalidateQueries({ queryKey: ['my-claims'] })
              }
            }}
          >
            Submit claim
          </Button>
          <div className="space-y-2 pt-2">
            {claims.map((c: { id: string; description: string; amount: number; status: string }) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg p-2">
                <span className="min-w-0 break-words">
                  {c.description} · ₹{c.amount}
                </span>
                <Badge className="shrink-0">{c.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">HR ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Details" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button
            className="w-full sm:w-auto"
            onClick={async () => {
              const res = await fetch('/api/hr/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, body }),
              })
              if (!res.ok) toast.error('Failed')
              else {
                toast.success('Ticket opened')
                setSubject('')
                setBody('')
                void qc.invalidateQueries({ queryKey: ['my-hr-tickets'] })
              }
            }}
          >
            Open ticket
          </Button>
          {tickets.map((t: { id: string; subject: string; status: string }) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg p-2">
              <span className="min-w-0 break-words">{t.subject}</span>
              <Badge className="shrink-0">{t.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {policies.map((p) => (
            <a key={p.id} href={p.fileUrl} className="block break-words py-1 text-sm underline" target="_blank" rel="noreferrer">
              {p.title}
            </a>
          ))}
          {policies.length === 0 && (
            <p className="text-sm text-muted-foreground">No policies published</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
