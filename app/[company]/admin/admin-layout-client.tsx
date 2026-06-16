'use client'

import { useSession } from "next-auth/react"
import { AdminNav } from "@/components/navigation/admin-nav"

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()

  return (
    <div className="flex h-screen bg-background">
      <AdminNav user={session?.user} />
      <main className="flex-1 overflow-y-auto bg-background p-8">
        {children}
      </main>
    </div>
  )
}
