'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Map, LifeBuoy } from 'lucide-react'
import { PageHeaderSkeleton, CardListSkeleton } from '@/components/loading'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

type HelpHubData = {
  company: { name: string; slug: string }
  knowledge: Array<{
    id: string
    title: string
    slug: string
    category?: string | null
  }>
  roadmap: Array<{
    id: string
    title: string
    status: string
    description?: string | null
    _count?: { votes: number }
  }>
}

function getVoterKey(slug: string) {
  const key = `roadmap-voter:${slug}`
  try {
    let v = localStorage.getItem(key)
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem(key, v)
    }
    return v
  } catch {
    return `anon-${slug}`
  }
}

export default function CompanyHelpHubPage() {
  const { company: companySlug } = useParams() as { company: string }
  const queryClient = useQueryClient()
  const [voterKey, setVoterKey] = useState('')

  useEffect(() => {
    setVoterKey(getVoterKey(companySlug))
  }, [companySlug])

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-help', companySlug],
    queryFn: async () => {
      const res = await fetch(`/api/help/${encodeURIComponent(companySlug)}`)
      if (!res.ok) throw new Error('Help hub not found')
      return res.json() as Promise<HelpHubData>
    },
  })

  const voteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/help/${encodeURIComponent(companySlug)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, voterKey }),
      })
      if (!res.ok) throw new Error('Vote failed')
      return res.json() as Promise<{ voted: boolean }>
    },
    onSuccess: (r) => {
      toast.success(r.voted ? 'Vote added' : 'Vote removed')
      queryClient.invalidateQueries({ queryKey: ['public-help', companySlug] })
    },
    onError: () => toast.error('Could not vote'),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <PageHeaderSkeleton />
        <CardListSkeleton rows={4} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">
        Help center unavailable for this workspace.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <LifeBuoy className="h-6 w-6" />
          {data.company.name} help
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Knowledge base and product roadmap
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Knowledge base
        </h2>
        {data.knowledge.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published articles yet.</p>
        ) : (
          <div className="space-y-2">
            {data.knowledge.map((a) => (
              <Card key={a.id} className="shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium">
                    <Link
                      href={`/portal/support?slug=${encodeURIComponent(a.slug)}`}
                      className="hover:underline"
                    >
                      {a.title}
                    </Link>
                  </CardTitle>
                  {a.category ? (
                    <CardDescription className="text-xs">{a.category}</CardDescription>
                  ) : null}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Map className="h-4 w-4" />
          Roadmap
        </h2>
        {data.roadmap.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public roadmap items.</p>
        ) : (
          <div className="space-y-2">
            {data.roadmap.map((item) => (
              <Card key={item.id} className="shadow-none">
                <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {item.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {item._count?.votes ?? 0} votes
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!voterKey || voteMutation.isPending}
                    onClick={() => voteMutation.mutate(item.id)}
                  >
                    Vote
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
