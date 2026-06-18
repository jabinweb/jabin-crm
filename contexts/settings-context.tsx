'use client'

import { createContext, useContext } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import type { CompanySettings, SettingsUpdateAction } from '@/types/settings'

interface SettingsContextType {
  company: {
    id: string;
    name: string;
    logo?: string;
    email?: string;
    phone?: string;
    website?: string;
    description?: string;
  } | null;
  settings: CompanySettings | null;
  isLoading: boolean;
  /** Populated when the settings query fails (e.g. tenant / access). */
  fetchError: Error | null;
  refetch: () => void;
  updateCompany: (data: Partial<SettingsContextType['company']>) => Promise<void>;
  updateSettings: (update: SettingsUpdateAction) => Promise<void>;
  isUpdating: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const params = useParams<{ company?: string }>()
  const workspaceSlug = typeof params?.company === 'string' ? params.company : undefined
  const tenantHeaders = workspaceSlug ? workspaceSlugHeaders(workspaceSlug) : {}

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['settings', workspaceSlug],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/settings', { headers: { ...tenantHeaders } })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
        const err = new Error(body.error || 'Failed to fetch settings') as Error & {
          code?: string
        }
        if (body.code) err.code = body.code
        throw err
      }
      const data = await res.json()
      
      // Initialize integrations structure if it doesn't exist
      return {
        company: data.company || {},
        settings: {
          ...data.settings,
          integrations: {
            razorpay: {
              enabled: false,
              mode: 'test',
              credentials: {
                test: { keyId: '', keySecret: '', webhookSecret: '' },
                live: { keyId: '', keySecret: '', webhookSecret: '' }
              },
              ...(data.settings?.integrations?.razorpay || {})
            },
            ...(data.settings?.integrations || {})
          }
        }
      }
    }
  })

  const mutation = useMutation({
    mutationFn: async ({ company, settings }: { company?: any, settings?: any }) => {
      console.log('Mutation received:', { company, settings })
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({ company, settings })
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string
          error?: string
        }
        const msg =
          (typeof body.message === 'string' && body.message) ||
          (typeof body.error === 'string' && body.error) ||
          'Failed to update settings'
        throw new Error(msg)
      }
      return res.json()
    },
    onSuccess: (data) => {
      console.log('Mutation success:', data)
      queryClient.setQueryData(['settings', workspaceSlug], data)
      queryClient.invalidateQueries({ queryKey: ['workspace-config'] })
      toast({
        title: "Success",
        description: "Settings updated successfully"
      })
    },
    onError: (error: unknown) => {
      const description =
        error instanceof Error ? error.message : 'Failed to update settings'
      toast({
        title: "Error",
        description,
        variant: "destructive"
      })
    }
  })

  return (
    <SettingsContext.Provider value={{
      company: data?.company || null,
      settings: data?.settings || null,
      isLoading,
      fetchError: queryError instanceof Error ? queryError : null,
      refetch,
      updateCompany: (companyData) => mutation.mutateAsync({ company: companyData }),
      updateSettings: (settingsData) => mutation.mutateAsync({ settings: settingsData }),
      isUpdating: mutation.isPending
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}
