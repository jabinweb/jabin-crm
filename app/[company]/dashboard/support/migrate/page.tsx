'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SupportBackLink } from '@/components/support/support-back-link'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { Database, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { DetailSkeleton } from '@/components/loading'

type FreshdeskSettings = {
  domain?: string
  apiKeyConfigured?: boolean
  notes?: string
}

export default function FreshdeskMigratePage() {
  const { path, slug, workspaceFetch } = useWorkspacePaths()
  const queryClient = useQueryClient()
  const [domain, setDomain] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['freshdesk-migrate', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/migrate')
      if (!res.ok) throw new Error('Failed to load')
      return res.json() as Promise<FreshdeskSettings>
    },
  })

  useEffect(() => {
    if (data) {
      setDomain(data.domain || '')
      setNotes(data.notes || '')
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/support/migrate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          notes,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Save failed')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Freshdesk settings saved')
      setApiKey('')
      queryClient.invalidateQueries({ queryKey: ['freshdesk-migrate'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <SupportBackLink />
        <DetailSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <SupportBackLink />
        <div>
          <h1 className="text-2xl font-bold">Freshdesk import</h1>
          <p className="text-sm text-muted-foreground">
            Store connection details, then run the migration wizard
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Freshdesk connection
          </CardTitle>
          <CardDescription>
            API key is stored encrypted in company settings and never shown again
            after save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Domain</Label>
            <Input
              placeholder="yourcompany.freshdesk.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>API key {data?.apiKeyConfigured ? '(configured)' : ''}</Label>
            <Input
              type="password"
              placeholder={
                data?.apiKeyConfigured ? 'Leave blank to keep existing' : '••••••••'
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              placeholder="Import scope, date cutover, owner…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              Save connection
            </Button>
            <Button asChild variant="outline">
              <Link href={path('/dashboard/settings/migration')}>
                Open migration wizard
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
