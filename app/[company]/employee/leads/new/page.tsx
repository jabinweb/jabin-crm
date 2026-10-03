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
        title: "Can't add this lead",
        description: "Your account isn't linked to an employee profile yet. Ask your HR admin to link it.",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          employeeId: session.user.employeeId
        })
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(typeof errBody.error === 'string' ? errBody.error : "Couldn't create the lead")
      }

      toast({ title: "Lead added" })

      router.push(employeePath('/employee/leads'))
      router.refresh()
    } catch (error) {
      toast({
        title: "Couldn't create the lead",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <LeadForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  )
}
