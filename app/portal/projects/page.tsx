'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FolderKanban } from 'lucide-react';
import { SectionSkeleton } from '@/components/loading';

type PortalProject = {
  id: string;
  name: string;
  description: string;
  status: string;
  projectType: string;
  progress: number;
  startDate: string;
  endDate: string;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  }>;
};

export default function PortalProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['portal-projects'],
    queryFn: async () => {
      const res = await fetch('/api/portal/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      return (await res.json()) as PortalProject[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SectionSkeleton lines={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track progress and milestones on your active engagements.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When your agency starts delivery work, it will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/portal/projects/${p.id}`} className="block">
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <Badge variant="secondary">{p.status}</Badge>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{p.progress}%</span>
                    </div>
                    <Progress value={p.progress} />
                  </div>
                  <ul className="space-y-1.5">
                    {p.milestones.slice(0, 4).map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span
                          className={
                            m.status === 'DONE'
                              ? 'text-muted-foreground line-through'
                              : ''
                          }
                        >
                          {m.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {m.status.replace('_', ' ')}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
