'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CardListSkeleton } from '@/components/loading'
import { QueryErrorState } from '@/components/hr/hr-ui'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { Network } from 'lucide-react'

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
  const role = node.designation?.name || node.jobTitle
  const dept = node.hrDepartment?.name || node.department
  return (
    <li className={depth === 0 ? 'min-w-0' : 'ml-2 mt-2 min-w-0 border-l pl-3 sm:ml-4 sm:pl-4'}>
      <div className="min-w-0 rounded-lg border bg-card px-3 py-2">
        <p className="break-words text-sm font-medium">{node.name}</p>
        <p className="break-words text-xs text-muted-foreground">
          {[role, dept].filter(Boolean).join(' · ') || '—'}
          {node.children.length > 0 &&
            ` · ${node.children.length} direct report${node.children.length === 1 ? '' : 's'}`}
        </p>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <OrgNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function OrgChartPage() {
  const { path } = useWorkspacePaths()
  const {
    data: employees = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
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
      <div className="min-w-0">
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
          ) : isError ? (
            <QueryErrorState title="Couldn’t load the org chart" onRetry={() => void refetch()} />
          ) : roots.length === 0 ? (
            <EmptyState
              icon={Network}
              title="No employees yet"
              description="Add employees and set their manager to build the org chart."
              actionLabel="Add employee"
              actionHref={path('/dashboard/employees/new')}
            />
          ) : (
            <ul className="space-y-4" aria-label="Reporting structure">
              {roots.map((n) => (
                <OrgNode key={n.id} node={n} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
