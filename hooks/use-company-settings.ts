import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'

interface CompanySettings {
  name?: string
  logo?: string
  email?: string
  phone?: string
  website?: string
  taxId?: string
  description?: string
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
}

export function useCompanySettings() {
  const queryClient = useQueryClient()
  const params = useParams<{ company?: string }>()
  const workspaceSlug = typeof params?.company === 'string' ? params.company : undefined
  const tenantHeaders = workspaceSlug ? workspaceSlugHeaders(workspaceSlug) : {}

  const { data: settings, isLoading } = useQuery({
    queryKey: ['companySettings', workspaceSlug],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/settings', { headers: { ...tenantHeaders } })
      if (!res.ok) throw new Error('Failed to fetch settings')
      const data = await res.json()
      return data?.company ?? data?.general ?? {}
    }
  })

  const mutation = useMutation({
    mutationFn: async (newSettings: Partial<CompanySettings>) => {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({
          company: {
            ...settings,
            ...newSettings
          }
        })
      })
      if (!res.ok) throw new Error('Failed to update settings')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settings updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: ['companySettings', workspaceSlug] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      })
    }
  })

  const updateSettings = (newSettings: Partial<CompanySettings>) => {
    mutation.mutate(newSettings)
  }

  return {
    settings,
    isLoading,
    updateSettings,
    isUpdating: mutation.isPending
  }
}
