'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function GuestTicketPage() {
  const { token } = useParams() as { token: string }
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(5)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['guest-ticket', token],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/guest/${token}`)
      if (!res.ok) throw new Error('Not found')
      return res.json()
    },
  })

  const reply = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tickets/guest/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', message }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      toast.success('Reply sent')
      setMessage('')
      void refetch()
    },
  })

  if (isLoading) return <p className="p-8 text-center text-muted-foreground">Loading…</p>
  if (!data) return <p className="p-8 text-center text-muted-foreground">Ticket not found</p>

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Support ticket</p>
        <h1 className="text-2xl font-semibold tracking-tight">{data.subject}</h1>
        <div className="mt-2 flex gap-2">
          <Badge>{data.status}</Badge>
          <Badge variant="outline">{data.priority}</Badge>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{data.description}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data.activities || []).map(
            (a: { id: string; description: string; createdAt: string; eventType: string }) => (
              <div key={a.id} className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {a.eventType} · {new Date(a.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{a.description}</p>
              </div>
            )
          )}
          <Textarea
            placeholder="Write a reply…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button disabled={!message || reply.isPending} onClick={() => reply.mutate()}>
            Send reply
          </Button>
        </CardContent>
      </Card>
      {(data.status === 'RESOLVED' || data.status === 'CLOSED') && !data.csatRating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How was our support?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={rating === n ? 'default' : 'outline'}
                onClick={() => setRating(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              onClick={async () => {
                await fetch(`/api/tickets/guest/${token}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'csat', rating }),
                })
                toast.success('Thanks for your feedback')
                void refetch()
              }}
            >
              Submit
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
