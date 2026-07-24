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
  if (isLoading) {
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
      <div className="rounded-none border overflow-x-auto">
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
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center text-xs text-blue-600 hover:underline"
                      >
                        <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </a>
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
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}{' '}
            of {data.pagination.total} leads
          </p>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
