'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function HrTicketsAdminPage() {
  const qc = useQueryClient()
  const { data: tickets = [] } = useQuery({
    queryKey: ['hr-tickets-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/tickets?admin=1')
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<
        {
          id: string
          subject: string
          category: string
          status: string
          body: string
          employee: { name: string; employeeId: string }
        }[]
      >
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">HR tickets</h1>
        <p className="text-sm text-muted-foreground">Employee helpdesk inbox.</p>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-6">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.employee.name} · {t.category}
                  </p>
                </div>
                <Badge>{t.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t.body}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await fetch('/api/hr/tickets', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: t.id, status: 'IN_PROGRESS' }),
                    })
                    void qc.invalidateQueries({ queryKey: ['hr-tickets-admin'] })
                  }}
                >
                  In progress
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    await fetch('/api/hr/tickets', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: t.id, status: 'RESOLVED' }),
                    })
                    toast.success('Resolved')
                    void qc.invalidateQueries({ queryKey: ['hr-tickets-admin'] })
                  }}
                >
                  Resolve
                </Button>
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">No tickets</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
