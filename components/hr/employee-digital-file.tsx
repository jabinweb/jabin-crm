'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { FileUp, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'

type Props = {
  employeeId: string
  companySlug?: string
  readOnly?: boolean
}

export function EmployeeDigitalFile({ employeeId, companySlug, readOnly }: Props) {
  const queryClient = useQueryClient()
  const headers = companySlug ? workspaceSlugHeaders(companySlug) : {}

  const [docTitle, setDocTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [depName, setDepName] = useState('')
  const [depRelation, setDepRelation] = useState('')
  const [noteText, setNoteText] = useState('')

  const { data: docs = [] } = useQuery({
    queryKey: ['emp-docs', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/documents`, { headers })
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: skills = [] } = useQuery({
    queryKey: ['emp-skills', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/skills`, { headers })
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: dependents = [] } = useQuery({
    queryKey: ['emp-deps', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/dependents`, { headers })
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: activities = [] } = useQuery({
    queryKey: ['emp-acts', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/activities`, { headers })
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: assets = [] } = useQuery({
    queryKey: ['emp-assets', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/assets?employeeId=${employeeId}`, { headers })
      if (!res.ok) return []
      return res.json()
    },
  })

  const uploadDoc = async (file: File) => {
    if (!docTitle.trim()) {
      toast.error('Enter a document title first')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', `employees/${employeeId}`)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!up.ok) throw new Error('Upload failed')
      const upData = await up.json()
      const fileUrl = upData.url || upData.file_url || upData.data?.url
      if (!fileUrl) throw new Error('No file URL returned')

      const res = await fetch(`/api/employees/${employeeId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          title: docTitle,
          fileUrl,
          mimeType: file.type,
          category: 'GENERAL',
        }),
      })
      if (!res.ok) throw new Error('Failed to save document')
      setDocTitle('')
      toast.success('Document added')
      void queryClient.invalidateQueries({ queryKey: ['emp-docs', employeeId] })
      void queryClient.invalidateQueries({ queryKey: ['emp-acts', employeeId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const addSkill = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: skillName, level: skillLevel || null }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      setSkillName('')
      setSkillLevel('')
      toast.success('Skill added')
      void queryClient.invalidateQueries({ queryKey: ['emp-skills', employeeId] })
    },
    onError: () => toast.error('Failed to add skill'),
  })

  const addDependent = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/dependents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: depName, relation: depRelation }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      setDepName('')
      setDepRelation('')
      toast.success('Dependent added')
      void queryClient.invalidateQueries({ queryKey: ['emp-deps', employeeId] })
    },
    onError: () => toast.error('Failed to add dependent'),
  })

  const addNote = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ message: noteText, type: 'NOTE' }),
      })
      if (!res.ok) throw new Error('Failed')
    },
    onSuccess: () => {
      setNoteText('')
      toast.success('Note added')
      void queryClient.invalidateQueries({ queryKey: ['emp-acts', employeeId] })
    },
    onError: () => toast.error('Failed to add note'),
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Digital employee file</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="docs">
          <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="docs">Documents</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="docs" className="space-y-4">
            {!readOnly && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Offer letter"
                  />
                </div>
                <label className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 bg-primary text-primary-foreground cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadDoc(f)
                      e.target.value = ''
                    }}
                  />
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="mr-2 h-4 w-4" />
                  )}
                  Upload
                </label>
              </div>
            )}
            <div className="space-y-2">
              {docs.map((d: { id: string; title: string; fileUrl: string; category: string; createdAt: string }) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.category} · {format(new Date(d.createdAt), 'd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={d.fileUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          await fetch(
                            `/api/employees/${employeeId}/documents?docId=${d.id}`,
                            { method: 'DELETE', headers }
                          )
                          void queryClient.invalidateQueries({
                            queryKey: ['emp-docs', employeeId],
                          })
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {docs.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
            {!readOnly && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Skill name"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                />
                <Input
                  placeholder="Level"
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                />
                <Button
                  disabled={!skillName.trim() || addSkill.isPending}
                  onClick={() => addSkill.mutate()}
                >
                  Add
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {skills.map((s: { id: string; name: string; level?: string | null }) => (
                <Badge key={s.id} variant="secondary" className="gap-2 py-1.5">
                  {s.name}
                  {s.level ? ` · ${s.level}` : ''}
                  {!readOnly && (
                    <button
                      type="button"
                      className="ml-1"
                      onClick={async () => {
                        await fetch(
                          `/api/employees/${employeeId}/skills?skillId=${s.id}`,
                          { method: 'DELETE', headers }
                        )
                        void queryClient.invalidateQueries({
                          queryKey: ['emp-skills', employeeId],
                        })
                      }}
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
              {skills.length === 0 && (
                <p className="text-sm text-muted-foreground">No skills listed</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="family" className="space-y-4">
            {!readOnly && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Name"
                  value={depName}
                  onChange={(e) => setDepName(e.target.value)}
                />
                <Input
                  placeholder="Relation"
                  value={depRelation}
                  onChange={(e) => setDepRelation(e.target.value)}
                />
                <Button
                  disabled={!depName.trim() || !depRelation.trim() || addDependent.isPending}
                  onClick={() => addDependent.mutate()}
                >
                  Add
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {dependents.map((d: { id: string; name: string; relation: string }) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.relation}</p>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        await fetch(
                          `/api/employees/${employeeId}/dependents?dependentId=${d.id}`,
                          { method: 'DELETE', headers }
                        )
                        void queryClient.invalidateQueries({
                          queryKey: ['emp-deps', employeeId],
                        })
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {dependents.length === 0 && (
                <p className="text-sm text-muted-foreground">No dependents</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="assets" className="space-y-2">
            {assets.map((a: { id: string; name: string; type: string; value: number }) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.type}</p>
                </div>
                <p className="text-sm">₹{Number(a.value).toLocaleString('en-IN')}</p>
              </div>
            ))}
            {assets.length === 0 && (
              <p className="text-sm text-muted-foreground">No assets assigned</p>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-3">
            {!readOnly && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Add a work history note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <Button
                  disabled={!noteText.trim() || addNote.isPending}
                  onClick={() => addNote.mutate()}
                >
                  Add note
                </Button>
              </div>
            )}
            {activities.map(
              (a: {
                id: string
                message: string
                type: string
                createdAt: string
                actor?: { name: string } | null
              }) => (
                <div key={a.id} className="border-l-2 pl-3 py-1">
                  <p className="text-sm">{a.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(a.createdAt), 'd MMM yyyy HH:mm')}
                    {a.actor?.name ? ` · ${a.actor.name}` : ''}
                    {` · ${a.type}`}
                  </p>
                </div>
              )
            )}
            {activities.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
