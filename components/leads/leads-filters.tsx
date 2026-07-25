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

type LeadsPageState = ReturnType<typeof useLeadsPage>;

interface LeadsFiltersProps extends Pick<
  LeadsPageState,
  'search' | 'setSearch' | 'status' | 'setStatus' | 'industry' | 'setIndustry' | 'source' | 'setSource' | 'filterOptions'
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
}: LeadsFiltersProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:min-w-[200px] sm:flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-3 sm:flex sm:flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:w-[150px] sm:text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {filterOptions?.statuses?.map((s: any) => {
              const icons: any = {
                NEW: '🆕',
                CONTACTED: '📞',
                RESPONDED: '💬',
                QUALIFIED: '✅',
                CONVERTED: '🎉',
                LOST: '❌',
                UNSUBSCRIBED: '🚫',
              };
              return (
                <SelectItem key={s.status} value={s.status}>
                  {icons[s.status] || ''} {s.status} ({s.count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:w-[150px] sm:text-sm">
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
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:w-[150px] sm:text-sm">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {filterOptions?.sources?.map((src: string) => {
              const icons: any = {
                'Google Places': '📍',
                'Manual': '✍️',
                'Import': '📥',
                'API': '🔌',
              };
              return (
                <SelectItem key={src} value={src}>
                  {icons[src] || ''} {src}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
