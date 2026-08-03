'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardListSkeleton } from '@/components/loading'

type Node = {
  id: string
  name: string
  jobTitle: string
  department: string
  managerId: string | null
  designation?: { name: string } | null
  hrDepartment?: { name: string } | null
  children: Node[]
}

function OrgNode({ node, depth = 0 }: { node: Node; depth?: number }) {
  return (
    <div className={depth === 0 ? '' : 'ml-4 border-l pl-4 mt-2'}>
      <div className="rounded-lg border px-3 py-2 bg-card">
        <p className="font-medium text-sm">{node.name}</p>
        <p className="text-xs text-muted-foreground">
          {node.designation?.name || node.jobTitle}
          {(node.hrDepartment?.name || node.department)
            ? ` · ${node.hrDepartment?.name || node.department}`
            : ''}
        </p>
      </div>
      {node.children.map((c) => (
        <OrgNode key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function OrgChartPage() {
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['hr-org-chart'],
    queryFn: async () => {
      const res = await fetch('/api/hr/org-chart')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const roots = useMemo(() => {
    const map = new Map<string, Node>()
    for (const e of employees as Omit<Node, 'children'>[]) {
      map.set(e.id, { ...e, children: [] })
    }
    const top: Node[] = []
    for (const node of Array.from(map.values())) {
      if (node.managerId && map.has(node.managerId)) {
        map.get(node.managerId)!.children.push(node)
      } else {
        top.push(node)
      }
    }
    return top
  }, [employees])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Org chart</h1>
        <p className="text-sm text-muted-foreground">
          Hierarchy based on each employee&apos;s manager assignment.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporting structure</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <CardListSkeleton rows={5} />
          ) : roots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees yet</p>
          ) : (
            <div className="space-y-4">
              {roots.map((n) => (
                <OrgNode key={n.id} node={n} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
