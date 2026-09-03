'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  MoreVertical,
} from 'lucide-react';
import { LeadScoreBadge } from '@/components/crm/lead-score-badge';
import { FullTableSkeleton } from '@/components/loading';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { type useLeadsPage } from '@/hooks/use-leads-page';

type LeadsPageState = ReturnType<typeof useLeadsPage>;

interface LeadsTableProps extends Pick<
  LeadsPageState,
  | 'data'
  | 'isLoading'
  | 'error'
  | 'selectedLeads'
  | 'page'
  | 'isGeneratingEmail'
  | 'path'
  | 'router'
  | 'handleSelectAll'
  | 'handleSelectLead'
  | 'setPage'
  | 'handleContactLead'
  | 'handleStatusChange'
  | 'handleConvertLead'
> {}

export function LeadsTable({
  data,
  isLoading,
  error,
  selectedLeads,
  page,
  isGeneratingEmail,
  path,
  router,
  handleSelectAll,
  handleSelectLead,
  setPage,
  handleContactLead,
  handleStatusChange,
  handleConvertLead,
}: LeadsTableProps) {
  const showSkeleton = useDelayedLoading(isLoading && !(data?.leads?.length));

  if (showSkeleton) {
    return <FullTableSkeleton columnCount={9} rowCount={5} />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading leads
      </div>
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {data?.leads?.map((lead: any) => (
          <div
            key={lead.id}
            className="rounded-2xl border bg-card p-3.5 space-y-2 active:bg-muted/40"
          >
            <div className="flex items-start gap-3">
              <Checkbox
                className="mt-1"
                checked={selectedLeads.includes(lead.id)}
                onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
              />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => router.push(path(`/dashboard/leads/${lead.id}`))}
              >
                <p className="font-semibold leading-snug">{lead.companyName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {[lead.industry, lead.source].filter(Boolean).join(' · ') || 'Lead'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      lead.status === 'CONVERTED' || lead.status === 'QUALIFIED'
                        ? 'default'
                        : lead.status === 'LOST' || lead.status === 'UNSUBSCRIBED'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {lead.status}
                  </Badge>
                  <LeadScoreBadge
                    score={lead.leadScore?.score || 0}
                    showNumber={true}
                    size="sm"
                  />
                </div>
              </button>
            </div>
            <div className="flex gap-2 pl-8">
              {lead.phone ? (
                <Button asChild variant="outline" size="sm" className="h-10 flex-1">
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    Call
                  </a>
                </Button>
              ) : null}
              {lead.email ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1"
                  onClick={() => router.push(path(`/dashboard/leads/${lead.id}?compose=1`))}
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Email
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                className="h-10 flex-1"
                onClick={() => router.push(path(`/dashboard/leads/${lead.id}`))}
              >
                Open
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 w-10 shrink-0 px-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => handleContactLead(lead.id)}
                    disabled={isGeneratingEmail}
                  >
                    {isGeneratingEmail ? 'Generating...' : 'Contact Lead'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(path(`/dashboard/leads/${lead.id}`))}>
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'NEW')}>
                    New
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'CONTACTED')}>
                    Contacted
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'RESPONDED')}>
                    Responded
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'QUALIFIED')}>
                    Qualified
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleConvertLead(lead.id)}>
                    Convert to Customer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'LOST')}>
                    Lost
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'UNSUBSCRIBED')}>
                    Unsubscribed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        {!data?.leads?.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No leads found</p>
        ) : null}
      </div>

      <div className="hidden md:block rounded-none border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedLeads.length === data?.leads?.length && data?.leads?.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="min-w-[200px]">Company</TableHead>
              <TableHead className="min-w-[100px]">Industry</TableHead>
              <TableHead className="min-w-[150px]">Contact Info</TableHead>
              <TableHead className="min-w-[80px]">Score</TableHead>
              <TableHead className="min-w-[100px]">Source</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="min-w-[120px]">Tags</TableHead>
              <TableHead className="min-w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.leads?.map((lead: any) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{lead.companyName}</p>
                      {lead.rating && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          ⭐ {lead.rating}
                          {lead.reviewCount && (
                            <span className="text-muted-foreground">({lead.reviewCount})</span>
                          )}
                        </span>
                      )}
                    </div>
                    {lead.address && (
                      <p className="text-xs text-muted-foreground flex items-center truncate">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{lead.address}</span>
                      </p>
                    )}
                    {lead.website && (
                      <Link
                        href={lead.website}
                        target="_blank"
                        className="text-xs text-blue-600 hover:underline flex items-center"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Website
                      </Link>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {lead.industry ? (
                    <Badge variant="outline" className="text-xs">
                      {lead.industry}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {lead.email && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(path(`/dashboard/leads/${lead.id}?compose=1`))
                        }
                        className="flex items-center text-xs text-blue-600 hover:underline"
                      >
                        <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </button>
                    )}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="flex items-center text-xs text-blue-600 hover:underline"
                      >
                        <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span>{lead.phone}</span>
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <LeadScoreBadge
                    score={lead.leadScore?.score || 0}
                    showNumber={true}
                    size="sm"
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {lead.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lead.status === 'CONVERTED' ? 'default' :
                        lead.status === 'QUALIFIED' ? 'default' :
                          lead.status === 'RESPONDED' ? 'secondary' :
                            lead.status === 'CONTACTED' ? 'secondary' :
                              lead.status === 'LOST' ? 'destructive' :
                                lead.status === 'UNSUBSCRIBED' ? 'destructive' :
                                  'outline'
                    }
                    className="text-xs"
                  >
                    {lead.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[120px]">
                    {lead.tags && lead.tags.length > 0 ? (
                      lead.tags.slice(0, 2).map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                    {lead.tags && lead.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{lead.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => handleContactLead(lead.id)}
                        disabled={isGeneratingEmail}
                      >
                        📧 {isGeneratingEmail ? 'Generating...' : 'Contact Lead'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(path(`/dashboard/leads/${lead.id}`))}>
                        👁️ View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'NEW')}>
                        🆕 New
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'CONTACTED')}>
                        📞 Contacted
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'RESPONDED')}>
                        💬 Responded
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'QUALIFIED')}>
                        ✅ Qualified
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleConvertLead(lead.id)}>
                        🎉 Convert to Customer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'LOST')}>
                        ❌ Lost
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'UNSUBSCRIBED')}>
                        🚫 Unsubscribed
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data?.pagination && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}{' '}
            of {data.pagination.total} leads
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setPage(page + 1)}
              disabled={page >= data.pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
