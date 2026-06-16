'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { CompanyTaskStatus } from "@prisma/client"

interface CompanyTask {
  id: string
  title: string
  description: string
  dueDate: string
  status: CompanyTaskStatus
  priority: number
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<CompanyTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/employee/tasks')
      if (!response.ok) throw new Error('Failed to fetch tasks')
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="container mx-auto p-8 space-y-12">
      <div className="border-b pb-8">
        <h1 className="text-xl font-black tracking-[0.25em] uppercase">Operational Task Pipeline</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-4 tracking-[0.2em] opacity-40">Node Assignment Ledger • System v4.9.1</p>
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
                  .filter(task => task.status === status)
                  .map(task => (
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
    </div>
  )
}
