'use client'

import { useSession } from "next-auth/react"
import { AnnouncementsCard } from "@/components/employee/announcements-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EssPageHeader } from "@/components/employee/mobile/page-header"

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const companyId = (session?.user as any)?.employeeCompanyId ?? (session?.user as any)?.companyId ?? 0

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 lg:mx-0 lg:max-w-3xl">
      <EssPageHeader title="Company Announcements" />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>All Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60dvh] sm:h-[600px]">
              <AnnouncementsCard companyId={companyId} />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
