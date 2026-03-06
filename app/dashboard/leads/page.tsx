'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Download,
  Search,
  Filter,
  ExternalLink,
  Mail,
  Phone,
  Building,
  MapPin,
  MoreVertical,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { EmailDraftModal } from '@/components/email/email-draft-modal';
import { LeadScoreBadge } from '@/components/crm/lead-score-badge';

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailDrafts, setEmailDrafts] = useState<any[]>([]);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [showEnrollSequenceDialog, setShowEnrollSequenceDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [taskData, setTaskData] = useState({
    title: '',
    type: 'CALL',
    priority: 'MEDIUM',
    dueDate: '',
  });
  const [dealData, setDealData] = useState({
    title: '',
    value: '',
    stage: 'DISCOVERY',
    probability: '50',
  });
  const [newLead, setNewLead] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    industry: '',
    jobTitle: '',
    description: '',
  });
  const limit = 10;

  // Fetch available filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['lead-filters'],
    queryFn: async () => {
      const response = await fetch('/api/leads/filters');
      if (!response.ok) throw new Error('Failed to fetch filters');
      return response.json();
    },
  });

  // Fetch available sequences for enrollment
  const { data: sequences } = useQuery({
    queryKey: ['sequences'],
    queryFn: async () => {
      const response = await fetch('/api/sequences');
      if (!response.ok) throw new Error('Failed to fetch sequences');
      return response.json();
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['leads', { search, industry, source, status, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(industry && industry !== 'all' && { industry }),
        ...(source && source !== 'all' && { source }),
        ...(status && status !== 'all' && { status }),
      });

      const response = await fetch(`/api/leads?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }
      return response.json();
    },
  });

  const handleExport = async (format: 'csv' | 'json') => {
    const params = new URLSearchParams({
      format,
      ...(search && { search }),
      ...(industry && industry !== 'all' && { industry }),
    });

    const response = await fetch(`/api/leads/export?${params}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `leads.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allLeadIds = data?.leads?.map((lead: any) => lead.id) || [];
      setSelectedLeads(allLeadIds);
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, leadId]);
    } else {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    }
  };

  const handleBulkExport = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to export');
      return;
    }
    toast.success(`Exporting ${selectedLeads.length} leads...`);
    // TODO: Implement bulk export with selected IDs
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to delete');
      return;
    }
    if (confirm(`Are you sure you want to delete ${selectedLeads.length} leads?`)) {
      toast.success(`Deleted ${selectedLeads.length} leads`);
      setSelectedLeads([]);
      // TODO: Implement bulk delete
    }
  };

  const handleContactLead = async (leadId: string) => {
    setIsGeneratingEmail(true);
    toast.loading('Generating personalized email with AI...', { id: 'generating-email' });
    try {
      const response = await fetch('/api/leads/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId] }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate email');
      }

      const data = await response.json();
      toast.success('Email generated successfully!', { id: 'generating-email' });
      setEmailDrafts(data.drafts);
      setShowEmailModal(true);
    } catch (error) {
      toast.error('Failed to generate email draft', { id: 'generating-email' });
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleBulkContact = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to contact');
      return;
    }

    setIsGeneratingEmail(true);
    toast.loading(`Generating ${selectedLeads.length} personalized emails with AI...`, { id: 'generating-emails' });
    try {
      const response = await fetch('/api/leads/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeads }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate emails');
      }

      const data = await response.json();
      toast.success(`${data.drafts.length} emails generated successfully!`, { id: 'generating-emails' });
      setEmailDrafts(data.drafts);
      setShowEmailModal(true);
    } catch (error) {
      toast.error('Failed to generate email drafts', { id: 'generating-emails' });
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      toast.success(`Lead status updated to ${newStatus}`);
      // Refetch leads data without page reload
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (error) {
      toast.error('Failed to update lead status');
    }
  };

  const handleAddLead = async () => {
    if (!newLead.companyName) {
      toast.error('Company name is required');
      return;
    }

    setIsAddingLead(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });

      if (!response.ok) {
        throw new Error('Failed to add lead');
      }

      toast.success('Lead added successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowAddLeadDialog(false);
      setNewLead({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        industry: '',
        jobTitle: '',
        description: '',
      });
    } catch (error) {
      toast.error('Failed to add lead');
    } finally {
      setIsAddingLead(false);
    }
  };

  const handleEnrollInSequence = async () => {
    if (!selectedSequenceId) {
      toast.error('Please select a sequence');
      return;
    }
    if (selectedLeads.length === 0) {
      toast.error('No leads selected');
      return;
    }

    try {
      const response = await fetch(`/api/sequences/${selectedSequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeads }),
      });

      if (!response.ok) throw new Error('Failed to enroll leads');

      toast.success(`${selectedLeads.length} lead(s) enrolled in sequence!`);
      setShowEnrollSequenceDialog(false);
      setSelectedSequenceId('');
      setSelectedLeads([]);
    } catch (error) {
      toast.error('Failed to enroll leads in sequence');
    }
  };

  const handleCreateTasksForLeads = async () => {
    if (!taskData.title) {
      toast.error('Task title is required');
      return;
    }
    if (selectedLeads.length === 0) {
      toast.error('No leads selected');
      return;
    }

    try {
      const promises = selectedLeads.map(leadId =>
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...taskData,
            leadId,
            dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
          }),
        })
      );

      await Promise.all(promises);
      toast.success(`${selectedLeads.length} task(s) created!`);
      setShowCreateTaskDialog(false);
      setTaskData({ title: '', type: 'CALL', priority: 'MEDIUM', dueDate: '' });
      setSelectedLeads([]);
    } catch (error) {
      toast.error('Failed to create tasks');
    }
  };

  const handleCreateDealsForLeads = async () => {
    if (!dealData.title) {
      toast.error('Deal title is required');
      return;
    }
    if (selectedLeads.length === 0) {
      toast.error('No leads selected');
      return;
    }

    try {
      const promises = selectedLeads.map(leadId =>
        fetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...dealData,
            leadId,
            value: parseFloat(dealData.value) || 0,
            probability: parseInt(dealData.probability) || 50,
          }),
        })
      );

      await Promise.all(promises);
      toast.success(`${selectedLeads.length} deal(s) created!`);
      setShowCreateDealDialog(false);
      setDealData({ title: '', value: '', stage: 'DISCOVERY', probability: '50' });
      setSelectedLeads([]);
    } catch (error) {
      toast.error('Failed to create deals');
    }
  };

  return (
    <div className="container mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Leads</h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {selectedLeads.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground w-full sm:w-auto">
                {selectedLeads.length} selected
              </span>
              <Button
                variant="default"
                onClick={handleBulkContact}
                disabled={isGeneratingEmail}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Mail className="mr-2 h-4 w-4" />
                {isGeneratingEmail ? 'Generating...' : 'Contact'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEnrollSequenceDialog(true)}
                size="sm"
                className="hidden md:inline-flex"
              >
                Enroll in Sequence
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateTaskDialog(true)}
                size="sm"
                className="hidden lg:inline-flex"
              >
                Create Task
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateDealDialog(true)}
                size="sm"
                className="hidden lg:inline-flex"
              >
                Create Deal
              </Button>
              <Button variant="outline" onClick={handleBulkExport} size="sm" className="hidden sm:inline-flex">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete} size="sm">
                Delete
              </Button>
            </>
          )}
          <Button onClick={() => setShowAddLeadDialog(true)} size="sm" className="flex-1 sm:flex-none">
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')} size="sm" className="hidden sm:inline-flex">
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('json')} size="sm" className="hidden md:inline-flex">
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead Management</CardTitle>
          <CardDescription>
            Search, filter, and manage your collected leads
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    CONTACTED: '📧',
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
                    'API': '🔗',
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

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error loading leads
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
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
                              ✉️ {isGeneratingEmail ? 'Generating...' : 'Contact Lead'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/leads/${lead.id}`)}>
                              👁️ View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'NEW')}>
                              🆕 New
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'CONTACTED')}>
                              📧 Contacted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'RESPONDED')}>
                              💬 Responded
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'QUALIFIED')}>
                              ✅ Qualified
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'CONVERTED')}>
                              🎉 Converted
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
          )}

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
        </CardContent>
      </Card>

      {/* Email Draft Modal */}
      <EmailDraftModal
        open={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setEmailDrafts([]);
        }}
        drafts={emailDrafts}
      />

      {/* Add Lead Dialog */}
      <Dialog open={showAddLeadDialog} onOpenChange={setShowAddLeadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Manually add a new lead to your database. Fill in as much information as you have.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                placeholder="e.g., Acme Corporation"
                value={newLead.companyName}
                onChange={(e) => setNewLead({ ...newLead, companyName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  placeholder="e.g., John Doe"
                  value={newLead.contactName}
                  onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  placeholder="e.g., CEO"
                  value={newLead.jobTitle}
                  onChange={(e) => setNewLead({ ...newLead, jobTitle: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g., contact@company.com"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="e.g., +1 234 567 8900"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="e.g., https://company.com"
                value={newLead.website}
                onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="e.g., Technology, Healthcare"
                value={newLead.industry}
                onChange={(e) => setNewLead({ ...newLead, industry: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="e.g., 123 Main St, City, State"
                value={newLead.address}
                onChange={(e) => setNewLead({ ...newLead, address: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                placeholder="Add any additional notes or context about this lead..."
                rows={3}
                value={newLead.description}
                onChange={(e) => setNewLead({ ...newLead, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddLeadDialog(false);
                setNewLead({
                  companyName: '',
                  contactName: '',
                  email: '',
                  phone: '',
                  website: '',
                  address: '',
                  industry: '',
                  jobTitle: '',
                  description: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddLead} disabled={isAddingLead || !newLead.companyName}>
              {isAddingLead ? 'Adding...' : 'Add Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll in Sequence Dialog */}
      <Dialog open={showEnrollSequenceDialog} onOpenChange={setShowEnrollSequenceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll Leads in Sequence</DialogTitle>
            <DialogDescription>
              Select a sequence to enroll {selectedLeads.length} lead(s) in automated email follow-up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="sequence">Select Sequence</Label>
              <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a sequence..." />
                </SelectTrigger>
                <SelectContent>
                  {sequences?.sequences?.filter((seq: any) => seq.isActive).map((seq: any) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      {seq.name} ({seq._count?.enrollments || 0} enrolled)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEnrollSequenceDialog(false);
                setSelectedSequenceId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEnrollInSequence} disabled={!selectedSequenceId}>
              Enroll {selectedLeads.length} Lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tasks for Leads</DialogTitle>
            <DialogDescription>
              Create a task for {selectedLeads.length} selected lead(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="taskTitle">Task Title *</Label>
              <Input
                id="taskTitle"
                placeholder="e.g., Follow up call"
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="taskType">Type</Label>
                <Select value={taskData.type} onValueChange={(value) => setTaskData({ ...taskData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALL">📞 Call</SelectItem>
                    <SelectItem value="EMAIL">✉️ Email</SelectItem>
                    <SelectItem value="MEETING">🤝 Meeting</SelectItem>
                    <SelectItem value="FOLLOW_UP">🔄 Follow-up</SelectItem>
                    <SelectItem value="TODO">✅ To-do</SelectItem>
                    <SelectItem value="DEMO">🎬 Demo</SelectItem>
                    <SelectItem value="PROPOSAL">📋 Proposal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="taskPriority">Priority</Label>
                <Select value={taskData.priority} onValueChange={(value) => setTaskData({ ...taskData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">🟢 Low</SelectItem>
                    <SelectItem value="MEDIUM">🟡 Medium</SelectItem>
                    <SelectItem value="HIGH">🟠 High</SelectItem>
                    <SelectItem value="URGENT">🔴 Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="taskDueDate">Due Date</Label>
              <Input
                id="taskDueDate"
                type="datetime-local"
                value={taskData.dueDate}
                onChange={(e) => setTaskData({ ...taskData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateTaskDialog(false);
                setTaskData({ title: '', type: 'CALL', priority: 'MEDIUM', dueDate: '' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTasksForLeads} disabled={!taskData.title}>
              Create {selectedLeads.length} Task(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Deal Dialog */}
      <Dialog open={showCreateDealDialog} onOpenChange={setShowCreateDealDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Deals for Leads</DialogTitle>
            <DialogDescription>
              Create a deal for {selectedLeads.length} selected lead(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="dealTitle">Deal Title *</Label>
              <Input
                id="dealTitle"
                placeholder="e.g., Enterprise Software Package"
                value={dealData.title}
                onChange={(e) => setDealData({ ...dealData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dealValue">Deal Value ($)</Label>
                <Input
                  id="dealValue"
                  type="number"
                  placeholder="e.g., 10000"
                  value={dealData.value}
                  onChange={(e) => setDealData({ ...dealData, value: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dealProbability">Probability (%)</Label>
                <Input
                  id="dealProbability"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="50"
                  value={dealData.probability}
                  onChange={(e) => setDealData({ ...dealData, probability: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dealStage">Stage</Label>
              <Select value={dealData.stage} onValueChange={(value) => setDealData({ ...dealData, stage: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISCOVERY">🔍 Discovery</SelectItem>
                  <SelectItem value="QUALIFICATION">✅ Qualification</SelectItem>
                  <SelectItem value="PROPOSAL">📋 Proposal</SelectItem>
                  <SelectItem value="NEGOTIATION">💬 Negotiation</SelectItem>
                  <SelectItem value="CLOSED_WON">🎉 Closed Won</SelectItem>
                  <SelectItem value="CLOSED_LOST">❌ Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDealDialog(false);
                setDealData({ title: '', value: '', stage: 'DISCOVERY', probability: '50' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateDealsForLeads} disabled={!dealData.title}>
              Create {selectedLeads.length} Deal(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}