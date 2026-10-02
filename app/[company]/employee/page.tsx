'use client'

import { useSession } from "next-auth/react"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { DetailSkeleton } from "@/components/loading"
import { EssPageHeader } from "@/components/employee/mobile/page-header"

interface EmployeeData {
  id: string
  name: string
  jobTitle: string
  department: string
  status: string
  employmentType: string
  // ... other fields you want to display
}

export default function EmployeeDashboard() {
  const { data: session } = useSession()
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEmployeeData() {
      try {
        const response = await fetch(`/api/employee/profile`)
        if (!response.ok) throw new Error('Failed to fetch employee data')
        
        const data = await response.json()
        setEmployeeData(data)
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load employee data"
        })
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.employeeId) {
      fetchEmployeeData()
    } else if (session) {
      // No employee profile to load — don't leave the skeleton up forever
      setLoading(false)
    }
  }, [session])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
        <EssPageHeader title="Employee Dashboard" />
        <DetailSkeleton />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Employee Dashboard" />
      
      {/* Employee Overview */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4 sm:text-xl">My Profile</h2>
        {employeeData && (
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Name</p>
              <p className="break-words font-medium">{employeeData.name}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Job Title</p>
              <p className="break-words font-medium">{employeeData.jobTitle}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Department</p>
              <p className="break-words font-medium">{employeeData.department}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Status</p>
              <p className="break-words font-medium">{employeeData.status}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Add more sections like:
          - Time Clock
          - Leave Requests
          - Recent Attendance
          - Tasks
          - Announcements
      */}
    </div>
  )
}
