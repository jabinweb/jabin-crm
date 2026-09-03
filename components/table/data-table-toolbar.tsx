'use client'

import { Cross2Icon } from '@radix-ui/react-icons'
import { Search } from 'lucide-react'
import { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { DataTableViewOptions } from './data-table-view-options'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterableColumns?: {
    [key: string]: {
      title: string
      options: { label: string; value: string }[]
    }
  }
  searchableColumn?: string
  onSearch?: (searchTerm: string) => void
}

export function DataTableToolbar<TData>({
  table,
  filterableColumns,
  searchableColumn,
  onSearch,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchableColumn && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${searchableColumn.toLowerCase()}…`}
              value={(table.getColumn(searchableColumn)?.getFilterValue() as string) ?? ''}
              onChange={(event) => {
                table.getColumn(searchableColumn)?.setFilterValue(event.target.value)
                onSearch?.(event.target.value)
              }}
              className="h-8 w-[150px] pl-8 lg:w-[250px]"
            />
          </div>
        )}

        {filterableColumns &&
          Object.entries(filterableColumns).map(
            ([key, column]) =>
              table.getColumn(key) && (
                <DataTableFacetedFilter
                  key={key}
                  column={table.getColumn(key)}
                  title={column.title}
                  options={column.options}
                />
              )
          )}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
