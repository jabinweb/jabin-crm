'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60">Performance</CardTitle>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight">Leads Generation</h3>
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-[250px] md:h-[350px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="currentColor" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
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