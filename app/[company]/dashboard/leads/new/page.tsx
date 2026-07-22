'use client'

import { LeadForm } from "@/components/leads/lead-form"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { useWorkspacePaths } from "@/hooks/use-workspace-paths"
import { workspaceSlugHeaders } from "@/lib/api/workspace-slug"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import type { LeadFormValues } from "@/lib/validations/lead"

export default function NewLeadPage() {
  const router = useRouter()
  const params = useParams<{ company: string }>()
  const { path, slug } = useWorkspacePaths()
  const { toast } = useToast()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: LeadFormValues) => {
    if (!session?.user?.employeeId) {
      toast({
        title: "Error",
        description: "You must be logged in as an employee to create leads",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...workspaceSlugHeaders(slug ?? params.company),
        },
        body: JSON.stringify({
          ...data,
          employeeId: session.user.employeeId
        })
      })

      if (!response.ok) throw new Error('Failed to create lead')

      toast({
        title: "Success",
        description: "Lead created successfully"
      })

      router.push(path("/dashboard/leads"))
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create lead",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <LeadForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  )
}
