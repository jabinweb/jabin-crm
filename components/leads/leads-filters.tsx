'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { type useLeadsPage } from '@/hooks/use-leads-page';
import { humanizeEnum } from '@/lib/crm/humanize-enum';

type LeadsPageState = ReturnType<typeof useLeadsPage>;

interface LeadsFiltersProps extends Pick<
  LeadsPageState,
  'search' | 'setSearch' | 'status' | 'setStatus' | 'industry' | 'setIndustry' | 'source' | 'setSource' | 'filterOptions' | 'setPage'
> {}

export function LeadsFilters({
  search,
  setSearch,
  status,
  setStatus,
  industry,
  setIndustry,
  source,
  setSource,
  filterOptions,
  setPage,
}: LeadsFiltersProps) {
  // Any filter change starts from the first page so results never land on an empty page.
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:min-w-[200px] sm:flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search leads"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => withReset(setSearch)(e.target.value)}
          className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Select value={status} onValueChange={withReset(setStatus)}>
          <SelectTrigger
            aria-label="Filter by status" className="h-11 w-full text-base sm:h-10 sm:w-[150px] sm:text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {filterOptions?.statuses?.map((s: any) => (
              <SelectItem key={s.status} value={s.status}>
                {humanizeEnum(s.status)} ({s.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={industry} onValueChange={withReset(setIndustry)}>
          <SelectTrigger
            aria-label="Filter by industry" className="h-11 w-full text-base sm:h-10 sm:w-[150px] sm:text-sm">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {filterOptions?.industries?.map((ind: string) => (
              <SelectItem key={ind} value={ind}>
                {ind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={withReset(setSource)}>
          <SelectTrigger
            aria-label="Filter by source" className="h-11 w-full text-base sm:h-10 sm:w-[150px] sm:text-sm">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {filterOptions?.sources?.map((src: string) => (
              <SelectItem key={src} value={src}>
                {humanizeEnum(src)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
