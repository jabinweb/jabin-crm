'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyTaskStatus } from '@prisma/client';
import { PageHeaderSkeleton, BoardSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

interface CompanyTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: CompanyTaskStatus;
  priority: number;
}

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project: { id: string; name: string };
}

export default function TasksPage() {
  const { path } = useWorkspacePaths();
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const [companyRes, projectRes] = await Promise.all([
        fetch('/api/employee/tasks'),
        fetch('/api/employee/project-tasks'),
      ]);
      if (companyRes.ok) {
        setTasks(await companyRes.json());
      }
      if (projectRes.ok) {
        setProjectTasks(await projectRes.json());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8 space-y-8">
        <PageHeaderSkeleton />
        <BoardSkeleton columns={3} cardsPerColumn={3} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 space-y-12">
      <div className="border-b pb-8">
        <h1 className="text-xl font-black tracking-[0.25em] uppercase">Operational Task Pipeline</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-4 tracking-[0.2em] opacity-40">Node Assignment Ledger • System v4.9.1</p>
      </div>

      {projectTasks.length > 0 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em]">Project delivery</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-[0.15em] opacity-40">
              Assigned project work items
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {projectTasks.map((task) => (
              <Card key={task.id} className="border-2 border-foreground/5 shadow-none bg-background rounded-none">
                <CardHeader className="border-b border-foreground/5 bg-muted/5 py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-widest">
                    <Link
                      href={path(
                        `/dashboard/projects/${task.project.id}/tasks/${task.id}`
                      )}
                      className="hover:underline"
                    >
                      {task.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {task.project.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[9px] font-bold rounded-none">
                      {task.status.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-bold rounded-none">
                      {task.priority}
                    </Badge>
                  </div>
                  {task.dueDate ? (
                    <p className="text-[9px] font-black uppercase tracking-tighter opacity-40">
                      Due: {new Date(task.dueDate).toLocaleDateString().toUpperCase()}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.2em]">Company tasks</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {['TODO', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
            <Card key={status} className="border-2 border-foreground/5 shadow-none bg-background rounded-none">
              <CardHeader className="border-b border-foreground/5 bg-muted/5">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">SEGMENT: {status.replace('_', ' ')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="space-y-6">
                  {tasks
                    .filter((task) => task.status === status)
                    .map((task) => (
                      <div key={task.id} className="p-6 border border-foreground/5 hover:border-foreground/20 transition-all cursor-default group">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-xs font-black uppercase tracking-widest">{task.title}</h3>
                          <Badge variant="outline" className="text-[9px] font-bold border-foreground/20 rounded-none group-hover:bg-foreground group-hover:text-background transition-colors">
                            PRIORITY: {task.priority}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-mono leading-relaxed text-muted-foreground mb-4">{task.description}</p>
                        {task.dueDate && (
                          <div className="flex items-center space-x-2 opacity-30 group-hover:opacity-100 transition-opacity">
                            <div className="w-1.5 h-1.5 bg-foreground" />
                            <p className="text-[9px] font-black uppercase tracking-tighter">
                              EXPIRATION: {new Date(task.dueDate).toLocaleDateString().toUpperCase()}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
