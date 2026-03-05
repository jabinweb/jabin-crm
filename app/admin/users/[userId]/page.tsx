import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function getUserDetails(userId: string) {
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

  return user;
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
      <div>
        <h2 className="text-3xl font-bold text-gray-900">User Details</h2>
        <p className="text-gray-600 mt-1">
          Detailed information about {user.name || user.email}
        </p>
      </div>

      {/* User Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-600">Name</p>
              <p className="text-lg font-semibold">{user.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Email</p>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Role</p>
              <Badge className="mt-1">{user.role}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Member Since</p>
              <p className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.subscription ? (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-600">Plan</p>
                  <p className="text-lg font-semibold">
                    {user.subscription.plan.displayName}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <Badge className="mt-1">{user.subscription.status}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Period End</p>
                  <p className="text-sm">
                    {new Date(user.subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-gray-500">No active subscription</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Usage Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-600">Leads Created</p>
              <p className="text-2xl font-bold">{user.usage?.leadsCreated || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Emails Sent</p>
              <p className="text-2xl font-bold">{user.usage?.emailsSent || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Campaigns</p>
              <p className="text-2xl font-bold">{user.usage?.campaignsCreated || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="leads">
            <TabsList>
              <TabsTrigger value="leads">
                Leads ({user._count.leads})
              </TabsTrigger>
              <TabsTrigger value="campaigns">
                Campaigns ({user._count.emailCampaigns})
              </TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="mt-4">
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
                  {user.leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.companyName}
                      </TableCell>
                      <TableCell>{lead.email || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{lead.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="campaigns" className="mt-4">
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
                  {user.emailCampaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{campaign.status}</Badge>
                      </TableCell>
                      <TableCell>{campaign.totalRecipients}</TableCell>
                      <TableCell>
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>



            <TabsContent value="profile" className="mt-4">
              {user.profile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Company Name</p>
                      <p>{user.profile.companyName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Industry</p>
                      <p>{user.profile.industry || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Website</p>
                      <p>{user.profile.website || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Company Size</p>
                      <p>{user.profile.companySize || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Description</p>
                    <p className="text-sm text-gray-700">
                      {user.profile.description || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Profile Complete
                    </p>
                    <Badge className={user.profile.isComplete ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {user.profile.isComplete ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No profile information available</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
