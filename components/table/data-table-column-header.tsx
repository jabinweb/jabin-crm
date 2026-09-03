'use client'

import { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        '-ml-3 h-8 gap-1.5 px-3 font-medium hover:bg-transparent',
        className
      )}
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      <span>{title}</span>
      {sorted === 'desc' ? (
        <ArrowDown className="size-3.5 text-muted-foreground" />
      ) : sorted === 'asc' ? (
        <ArrowUp className="size-3.5 text-muted-foreground" />
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground/70" />
      )}
    </Button>
  )
}
