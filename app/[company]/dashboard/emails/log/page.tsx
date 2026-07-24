'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label as FormLabel } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Mail, 
  Search, 
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  MoreVertical,
  Filter,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { FullTableSkeleton } from '@/components/loading';

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  body?: string;
  status: 'SENT' | 'FAILED' | 'PENDING' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'REPLIED';
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
  replySubject?: string;
  replyBody?: string;
  errorMessage?: string;
  leadId?: string;
  campaignId?: string;
  lead?: {
    companyName: string;
    contactName?: string;
  };
  campaign?: {
    name: string;
  };
}

const statusConfig = {
  SENT: { color: 'bg-blue-500', icon: Send, label: 'Sent' },
  DELIVERED: { color: 'bg-green-500', icon: CheckCircle2, label: 'Delivered' },
  OPENED: { color: 'bg-purple-500', icon: Eye, label: 'Opened' },
  CLICKED: { color: 'bg-indigo-500', icon: CheckCircle2, label: 'Clicked' },
  REPLIED: { color: 'bg-emerald-500', icon: Mail, label: 'Replied' },
  PENDING: { color: 'bg-yellow-500', icon: Clock, label: 'Pending' },
  FAILED: { color: 'bg-red-500', icon: XCircle, label: 'Failed' },
  BOUNCED: { color: 'bg-orange-500', icon: XCircle, label: 'Bounced' },
};

export default function EmailLogPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    const fromUrl = searchParams.get('status');
    if (fromUrl) setStatus(fromUrl);
  }, [searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['email-logs', { search, status, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status && status !== 'all' && { status }),
      });

      const response = await fetch(`/api/emails/log?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch email logs');
      }
      return response.json();
    },
  });

  const handleViewDetails = (email: EmailLog) => {
    setSelectedEmail(email);
    setShowDetailsDialog(true);
  };

  const handleResend = async (email: EmailLog) => {
    setResendingId(email.id);
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.to,
          subject: email.subject,
          body: email.body || '',
          leadId: email.leadId,
          campaignId: email.campaignId,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to resend email';
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || error.details || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.statusText || response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      toast.success(`Email resent to ${email.to}`);
      
      // Refresh the email logs
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    } catch (error: any) {
      console.error('Error resending email:', error);
      toast.error(error.message || 'Failed to resend email');
    } finally {
      setResendingId(null);
    }
  };

  const getStatusBadge = (status: EmailLog['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className="flex items-center gap-1 w-fit">
        <div className={`w-2 h-2 rounded-none ${config.color}`} />
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const emailStats = data?.stats || {
    total: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    failed: 0,
    bounced: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Email Log</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailStats.sent}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailStats.delivered}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailStats.openRate}%</div>
            <p className="text-xs text-muted-foreground">
              {emailStats.opened} opened
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailStats.clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              {emailStats.clicked} clicked
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Mail className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailStats.replyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {emailStats.replied} replied
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Activity</CardTitle>
          <CardDescription>
            Track all sent emails, delivery status, and engagement metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by recipient or subject..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            
            <Select value={status} onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="OPENED">Opened</SelectItem>
                <SelectItem value="CLICKED">Clicked</SelectItem>
                <SelectItem value="REPLIED">Replied</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="BOUNCED">Bounced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <FullTableSkeleton columnCount={6} rowCount={5} />
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load email logs
            </div>
          ) : data?.logs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No email logs found
            </div>
          ) : (
            <>
              <div className="border rounded-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Lead/Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs?.map((email: EmailLog) => (
                      <TableRow key={email.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{email.to}</span>
                            {email.lead?.contactName && (
                              <span className="text-xs text-muted-foreground">
                                {email.lead.contactName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {email.subject}
                        </TableCell>
                        <TableCell>
                          {email.lead?.companyName && (
                            <div className="text-sm">
                              <div className="font-medium">{email.lead.companyName}</div>
                            </div>
                          )}
                          {email.campaign?.name && (
                            <Badge variant="secondary" className="text-xs">
                              {email.campaign.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(email.status)}</TableCell>
                        <TableCell>
                          {email.sentAt ? (
                            <div className="flex flex-col text-sm">
                              <span>{format(new Date(email.sentAt), 'MMM d, yyyy')}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(email.sentAt), 'h:mm a')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleViewDetails(email)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleResend(email)}
                                disabled={resendingId === email.id}
                              >
                                <RefreshCw className={`mr-2 h-4 w-4 ${resendingId === email.id ? 'animate-spin' : ''}`} />
                                {resendingId === email.id ? 'Resending...' : 'Resend Email'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
                    {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}{' '}
                    of {data.pagination.total} emails
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
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
          )}
        </CardContent>
      </Card>

      {/* Email Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              Detailed information about this email
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FormLabel className="text-sm font-medium text-muted-foreground">Status</FormLabel>
                  <div className="mt-1">{getStatusBadge(selectedEmail.status)}</div>
                </div>
                
                <div>
                  <FormLabel className="text-sm font-medium text-muted-foreground">Recipient</FormLabel>
                  <div className="mt-1 text-sm">{selectedEmail.to}</div>
                </div>
                
                <div className="col-span-2">
                  <FormLabel className="text-sm font-medium text-muted-foreground">Subject</FormLabel>
                  <div className="mt-1 text-sm">{selectedEmail.subject}</div>
                </div>
                
                {selectedEmail.lead && (
                  <div className="col-span-2">
                    <FormLabel className="text-sm font-medium text-muted-foreground">Lead</FormLabel>
                    <div className="mt-1 text-sm">
                      <div className="font-medium">{selectedEmail.lead.companyName}</div>
                      {selectedEmail.lead.contactName && (
                        <div className="text-muted-foreground">{selectedEmail.lead.contactName}</div>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedEmail.campaign && (
                  <div className="col-span-2">
                    <FormLabel className="text-sm font-medium text-muted-foreground">Campaign</FormLabel>
                    <div className="mt-1 text-sm">{selectedEmail.campaign.name}</div>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Timeline</h4>
                <div className="space-y-3">
                  {selectedEmail.sentAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-none bg-blue-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Sent</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(selectedEmail.sentAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedEmail.deliveredAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-none bg-green-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Delivered</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(selectedEmail.deliveredAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedEmail.openedAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-none bg-purple-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Opened</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(selectedEmail.openedAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedEmail.clickedAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-none bg-indigo-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Clicked</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(selectedEmail.clickedAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedEmail.repliedAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-none bg-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-emerald-600">Replied</div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {format(new Date(selectedEmail.repliedAt), 'MMM d, yyyy h:mm a')}
                        </div>
                        {selectedEmail.replySubject && (
                          <div className="mt-2 p-3 bg-muted rounded-none">
                            <div className="text-xs font-medium mb-1">
                              Subject: {selectedEmail.replySubject}
                            </div>
                            {selectedEmail.replyBody && (
                              <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto">
                                {selectedEmail.replyBody.substring(0, 500)}
                                {selectedEmail.replyBody.length > 500 && '...'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedEmail.errorMessage && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-none bg-red-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-red-600">Error</div>
                        <div className="text-xs text-muted-foreground">
                          {selectedEmail.errorMessage}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

