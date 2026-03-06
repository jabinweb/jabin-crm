'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Mail, MousePointer, Reply, AlertCircle, DollarSign, Target, Award } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';

interface PipelineData {
  pipeline: Array<{ stage: string; count: number; value: number }>;
  dealsByMonth: Array<{ month: string; count: number; value: number }>;
  summary: {
    totalPipelineValue: number;
    weightedPipelineValue: number;
    totalDeals: number;
    wonDeals: number;
    wonValue: number;
    lostDeals: number;
    lostValue: number;
    winRate: number;
  };
}

interface EmailData {
  summary: {
    totalSent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  };
  emailsByDay: Array<{ date: string; sent: number; opened: number; clicked: number }>;
  sequencePerformance: Array<{
    sequenceId: string;
    name: string;
    totalEnrollments: number;
    active: number;
    completed: number;
    completionRate: number;
  }>;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AnalyticsPage() {
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null);
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    async function fetchData() {
      try {
        const [pipelineRes, emailRes] = await Promise.all([
          fetch('/api/analytics/pipeline'),
          fetch('/api/analytics/email'),
        ]);

        if (pipelineRes.ok) {
          const data = await pipelineRes.json();
          setPipelineData(data);
        }

        if (emailRes.ok) {
          const data = await emailRes.json();
          setEmailData(data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-gray-500">Track your sales performance and email engagement</p>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Analytics</TabsTrigger>
          <TabsTrigger value="email">Email Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-6">
          {/* Pipeline Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(pipelineData?.summary.totalPipelineValue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pipelineData?.summary.totalDeals || 0} active deals
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weighted Pipeline</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(pipelineData?.summary.weightedPipelineValue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on win probability
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {pipelineData?.summary.winRate.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {pipelineData?.summary.wonDeals || 0} won / {pipelineData?.summary.lostDeals || 0} lost
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Won Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(pipelineData?.summary.wonValue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Closed deals
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline by Stage */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline by Stage</CardTitle>
              <CardDescription>Deal count and value across stages</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={pipelineData?.pipeline || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8b5cf6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#8b5cf6" name="Deal Count" />
                  <Bar yAxisId="right" dataKey="value" fill="#06b6d4" name="Total Value ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Deal Trends</CardTitle>
              <CardDescription>Monthly deal count and revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={pipelineData?.dealsByMonth || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8b5cf6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Deals Created" 
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    name="Total Value ($)" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          {/* Email Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {emailData?.summary.totalSent || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total emails delivered
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {emailData?.summary.openRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {emailData?.summary.opened || 0} opened
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {emailData?.summary.clickRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {emailData?.summary.clicked || 0} clicked
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
                <Reply className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {emailData?.summary.replyRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {emailData?.summary.replied || 0} replied
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Email Engagement Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Email Engagement (Last 30 Days)</CardTitle>
              <CardDescription>Daily email performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={emailData?.emailsByDay || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sent" stroke="#8b5cf6" strokeWidth={2} name="Sent" />
                  <Line type="monotone" dataKey="opened" stroke="#06b6d4" strokeWidth={2} name="Opened" />
                  <Line type="monotone" dataKey="clicked" stroke="#10b981" strokeWidth={2} name="Clicked" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sequence Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Sequence Performance</CardTitle>
              <CardDescription>Active email sequences and completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emailData?.sequencePerformance.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No active sequences yet</p>
                ) : (
                  emailData?.sequencePerformance.map((seq) => (
                    <div key={seq.sequenceId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{seq.name}</h3>
                        <p className="text-sm text-gray-500">
                          {seq.totalEnrollments} enrollments • {seq.active} active • {seq.completed} completed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">
                          {seq.completionRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500">Completion rate</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Engagement Breakdown Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Breakdown</CardTitle>
              <CardDescription>Distribution of email engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Opened', value: emailData?.summary.opened || 0 },
                      { name: 'Clicked', value: emailData?.summary.clicked || 0 },
                      { name: 'Replied', value: emailData?.summary.replied || 0 },
                      { name: 'Bounced', value: emailData?.summary.bounced || 0 },
                      { 
                        name: 'Not Opened', 
                        value: (emailData?.summary.totalSent || 0) - (emailData?.summary.opened || 0) 
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
