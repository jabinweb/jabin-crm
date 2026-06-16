'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When opened from `/{slug}/...`, pre-fill that slug (same value you want to save). */
  presetSlug?: string | null
}

function slugifyForPath(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function NoCompanyWorkspaceDialog({ open, onOpenChange, presetSlug }: Props) {
  const { toast } = useToast()
  const [slugDraft, setSlugDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (presetSlug?.trim()) {
      setSlugDraft(slugifyForPath(presetSlug))
    }
  }, [open, presetSlug])

  const handleSave = async () => {
    const s = slugifyForPath(slugDraft)
    if (!s) return
    setSaving(true)
    try {
      const res = await fetch('/api/user/workspace-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: s }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; slug?: string }
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save workspace URL')
      }
      const nextSlug = typeof data.slug === 'string' ? data.slug : s
      toast({
        title: 'Workspace URL saved',
        description: 'Reloading your dashboard…',
      })
      onOpenChange(false)
      window.location.assign(`/${nextSlug}/dashboard`)
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: e instanceof Error ? e.message : 'Something went wrong',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your workspace URL</DialogTitle>
          <DialogDescription>
            This becomes your team link (for example{' '}
            <span className="font-mono text-foreground">/your-slug/dashboard</span>). Your account
            already exists—we only create the workspace and attach it to you. You can finish company
            details later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="workspace-slug">Workspace URL slug</Label>
            <Input
              id="workspace-slug"
              placeholder="e.g. acme-corp"
              value={slugDraft}
              onChange={(e) => setSlugDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !saving && handleSave()}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Letters, numbers, and hyphens only. Must be unique across the platform.
            </p>
            <Button
              type="button"
              className="w-full"
              disabled={saving || !slugifyForPath(slugDraft)}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save workspace URL'}
            </Button>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" variant="outline" className="w-full" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
