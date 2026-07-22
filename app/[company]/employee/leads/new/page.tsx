'use client'

import { LeadForm } from "@/components/leads/lead-form"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import type { LeadFormValues } from "@/lib/validations/lead"
import { useWorkspacePaths } from "@/hooks/use-workspace-paths"

export default function NewEmployeeLeadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const { employeePath } = useWorkspacePaths()
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
      const response = await fetch('/api/employee/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      router.push(employeePath('/employee/leads'))
      router.refresh()
    } catch {
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
    <div className="max-w-4xl py-8 px-4 sm:px-6">
      <LeadForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  )
}
