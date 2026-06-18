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
    <div className="flex items-center space-x-4 mb-4">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[170px]">
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
        <SelectTrigger className="w-[170px]">
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
        <SelectTrigger className="w-[170px]">
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
  );
}
