import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeatureModulesCard } from "@/components/admin/feature-modules-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanizeEnum } from "@/lib/format/humanize";

type UserDetailRow = Prisma.UserGetPayload<{
  include: {
    profile: true;
    subscription: { include: { plan: true } };
    usage: true;
    leads: { take: 10; orderBy: { createdAt: "desc" } };
    emailCampaigns: { take: 10; orderBy: { createdAt: "desc" } };
    _count: {
      select: { leads: true; emailCampaigns: true; emailLogs: true };
    };
  };
}>;

async function getUserDetails(userId: string): Promise<UserDetailRow> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      subscription: {
        include: {
          plan: true,
        },
      },
      usage: true,
      leads: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      emailCampaigns: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          leads: true,
          emailCampaigns: true,
          emailLogs: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  return user as UserDetailRow;
}

const shortDate = (value: Date | string) => format(new Date(value), "MMM d, yyyy");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-20 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getUserDetails(userId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/users">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Users
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {user.name || user.email}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            Account, plan, usage, and module access
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Name">
              <p className="text-base font-semibold">{user.name || "Not set"}</p>
            </Field>
            <Field label="Email">
              <p className="text-base break-all">{user.email}</p>
            </Field>
            <Field label="Role">
              <Badge className="mt-1">{humanizeEnum(user.role)}</Badge>
            </Field>
            <Field label="Member since">
              <p className="text-sm">{shortDate(user.createdAt)}</p>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.subscription ? (
              <>
                <Field label="Plan">
                  <p className="text-base font-semibold">{user.subscription.plan.displayName}</p>
                </Field>
                <Field label="Status">
                  <Badge className="mt-1">{humanizeEnum(user.subscription.status)}</Badge>
                </Field>
                <Field label="Current period ends">
                  <p className="text-sm">{shortDate(user.subscription.currentPeriodEnd)}</p>
                </Field>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No subscription on this account. Team members inherit their company&apos;s plan.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Usage this period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Leads created">
              <p className="text-2xl font-semibold tabular-nums">{user.usage?.leadsCreated || 0}</p>
            </Field>
            <Field label="Emails sent">
              <p className="text-2xl font-semibold tabular-nums">{user.usage?.emailsSent || 0}</p>
            </Field>
            <Field label="Campaigns">
              <p className="text-2xl font-semibold tabular-nums">
                {user.usage?.campaignsCreated || 0}
              </p>
            </Field>
          </CardContent>
        </Card>
      </div>

      <FeatureModulesCard userId={user.id} />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="leads">
            <TabsList>
              <TabsTrigger value="leads">Leads ({user._count.leads})</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns ({user._count.emailCampaigns})</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="mt-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.leads.length === 0 ? (
                      <EmptyRow colSpan={4}>This user hasn&apos;t created any leads.</EmptyRow>
                    ) : (
                      user.leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.companyName}</TableCell>
                          <TableCell>{lead.email || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{humanizeEnum(lead.status)}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {shortDate(lead.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {user._count.leads > user.leads.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the 10 most recent of {user._count.leads} leads.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="campaigns" className="mt-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.emailCampaigns.length === 0 ? (
                      <EmptyRow colSpan={4}>This user hasn&apos;t created any campaigns.</EmptyRow>
                    ) : (
                      user.emailCampaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{humanizeEnum(campaign.status)}</Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">{campaign.totalRecipients}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {shortDate(campaign.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="profile" className="mt-4">
              {user.profile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 break-words">
                    <Field label="Company name">
                      <p>{user.profile.companyName || "—"}</p>
                    </Field>
                    <Field label="Industry">
                      <p>{user.profile.industry || "—"}</p>
                    </Field>
                    <Field label="Website">
                      <p className="break-all">{user.profile.website || "—"}</p>
                    </Field>
                    <Field label="Company size">
                      <p>{user.profile.companySize || "—"}</p>
                    </Field>
                  </div>
                  <Field label="Description">
                    <p className="text-sm">{user.profile.description || "—"}</p>
                  </Field>
                  <Field label="Profile complete">
                    <Badge
                      className={
                        user.profile.isComplete
                          ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                      }
                    >
                      {user.profile.isComplete ? "Complete" : "Incomplete"}
                    </Badge>
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This user hasn&apos;t filled in a profile yet.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
