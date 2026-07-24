'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { SectionSkeleton } from '@/components/loading';

export function LeadsChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-chart'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/chart');
      if (!response.ok) throw new Error('Failed to fetch chart data');
      return response.json();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardDescription>Pipeline</CardDescription>
        <CardTitle className="text-lg">Lead activity</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        {isLoading ? (
          <SectionSkeleton lines={8} className="h-[250px] md:h-[280px] justify-center py-8" />
        ) : !data?.length ? (
          <div className="flex items-center justify-center h-[250px] md:h-[280px] text-sm text-muted-foreground">
            No lead activity yet this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="currentColor" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="currentColor"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorLeads)"
                className="text-primary"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}