'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function CareersPage() {
  const { company } = useParams() as { company: string }
  const [jobId, setJobId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const { data } = useQuery({
    queryKey: ['careers', company],
    queryFn: async () => {
      const res = await fetch(`/api/careers/${company}`)
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{
        company: { name: string }
        jobs: { id: string; title: string; department: string | null; description: string }[]
      }>
    },
  })

  const apply = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/careers/${company}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, name, email, phone, source: 'careers' }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Application submitted')
      setName('')
      setEmail('')
      setPhone('')
    },
    onError: () => toast.error('Could not apply'),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div>
        <p className="text-sm text-muted-foreground">Careers</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {data?.company.name || 'Open roles'}
        </h1>
      </div>
      <div className="space-y-4">
        {(data?.jobs || []).map((j) => (
          <Card key={j.id}>
            <CardHeader>
              <CardTitle className="text-lg">{j.title}</CardTitle>
              {j.department && (
                <p className="text-sm text-muted-foreground">{j.department}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm whitespace-pre-wrap">{j.description}</p>
              <Button variant="outline" onClick={() => setJobId(j.id)}>
                Apply for this role
              </Button>
            </CardContent>
          </Card>
        ))}
        {(data?.jobs || []).length === 0 && (
          <p className="text-muted-foreground">No open positions right now.</p>
        )}
      </div>
      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button
                disabled={!name || !email || apply.isPending}
                onClick={() => apply.mutate()}
              >
                Submit application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
