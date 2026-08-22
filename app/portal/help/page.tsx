'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BookOpen, Map, LifeBuoy } from 'lucide-react'

export default function PortalHelpHubPage() {
  const { data: session } = useSession()
  const companySlug = (session?.user as { companySlug?: string } | undefined)?.companySlug

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <LifeBuoy className="h-6 w-6" />
          Help center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Guides and roadmap for your workspace
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Knowledge base
            </CardTitle>
            <CardDescription>How-to articles and FAQs</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/portal/support"
              className="text-sm text-primary hover:underline"
            >
              Browse articles →
            </Link>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Map className="h-4 w-4" />
              Roadmap
            </CardTitle>
            <CardDescription>Vote on what we build next</CardDescription>
          </CardHeader>
          <CardContent>
            {companySlug ? (
              <Link
                href={`/${companySlug}/help`}
                className="text-sm text-primary hover:underline"
              >
                Open public roadmap →
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sign in with a company workspace to open the public help hub.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Need more help?</CardTitle>
          <CardDescription>
            Submit a ticket from the support portal or contact your account team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/portal/tickets"
            className="text-sm text-primary hover:underline"
          >
            My tickets →
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
