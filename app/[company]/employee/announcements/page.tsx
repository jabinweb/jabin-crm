'use client'

import { useSession } from "next-auth/react"
import { AnnouncementsCard } from "@/components/employee/announcements-card"
import { EssPageHeader } from "@/components/employee/mobile/page-header"

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const companyId = (session?.user as any)?.employeeCompanyId ?? (session?.user as any)?.companyId ?? 0

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Announcements" subtitle="Updates from your company" />
      <AnnouncementsCard companyId={companyId} />
    </div>
  )
}
