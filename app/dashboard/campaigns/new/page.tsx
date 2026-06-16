'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Mail,
  Send,
  Save,
  Loader2,
  Users,
  Calendar,
  Sparkles,
  Info,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showLeadSelector, setShowLeadSelector] = useState(true); // Start with selector open
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiParams, setAiParams] = useState({
    yourCompany: '',
    yourService: '',
    campaignGoal: '',
    tone: 'professional' as 'professional' | 'casual' | 'friendly' | 'urgent',
  });
  
  // Lead filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterTag, setFilterTag] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    emailTemplate: '',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    scheduledAt: '',
  });

  // Fetch user profile for default sender info
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });

  // Pre-fill sender info when profile loads
  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        fromName: prev.fromName || profile.companyName || '',
        fromEmail: prev.fromEmail || profile.user?.email || '',
        replyTo: prev.replyTo || profile.user?.email || '',
      }));
    }
  }, [profile]);

  // Fetch available filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['lead-filters'],
    queryFn: async () => {
      const response = await fetch('/api/leads/filters');
      if (!response.ok) throw new Error('Failed to fetch filters');
      return response.json();
    },
  });

  // Fetch available leads with filters (only leads with email)
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-for-campaign', filterStatus, filterIndustry, filterSource, filterTag],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '500',
        ...(filterStatus && filterStatus !== 'all' && { status: filterStatus }),
        ...(filterIndustry && filterIndustry !== 'all' && { industry: filterIndustry }),
        ...(filterSource && filterSource !== 'all' && { source: filterSource }),
      });
      const response = await fetch(`/api/leads?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      
      // Filter to only include leads with email addresses
      return {
        ...data,
        leads: data.leads?.filter((lead: any) => lead.email) || [],
      };
    },
    enabled: showLeadSelector,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  };

  const selectAllLeads = () => {
    if (leadsData?.leads) {
      const allIds = leadsData.leads.map((lead: any) => lead.id);
      setSelectedLeads(allIds);
    }
  };

  const clearSelection = () => {
    setSelectedLeads([]);
  };

  const selectByStatus = (status: string) => {
    if (leadsData?.leads) {
      const filtered = leadsData.leads
        .filter((lead: any) => lead.status === status)
        .map((lead: any) => lead.id);
      setSelectedLeads(filtered);
      toast.success(`Selected ${filtered.length} ${status} leads`);
    }
  };

  const selectByIndustry = (industry: string) => {
    if (leadsData?.leads) {
      const filtered = leadsData.leads
        .filter((lead: any) => lead.industry === industry)
        .map((lead: any) => lead.id);
      setSelectedLeads(filtered);
      toast.success(`Selected ${filtered.length} ${industry} leads`);
    }
  };

  const generateEmailWithAI = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one recipient first');
      return;
    }

    setGeneratingEmail(true);
    try {
      const response = await fetch('/api/ai/generate-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeads,
          ...aiParams,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate email');
      }

      // Auto-fill the form with generated content
      setFormData((prev) => ({
        ...prev,
        subject: data.subject,
        emailTemplate: data.content,
      }));

      setShowAiDialog(false);
      toast.success('Email generated successfully!');
      
      // Show insights if available
      if (data.insights) {
        setTimeout(() => {
          toast.info(data.insights, { duration: 6000 });
        }, 500);
      }
    } catch (error: any) {
      console.error('Error generating email:', error);
      toast.error(error.message || 'Failed to generate email');
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleSave = async (asDraft: boolean) => {
    if (!formData.name || !formData.subject || !formData.emailTemplate) {
      toast.error('Please fill in campaign name, subject, and email template');
      return;
    }

    if (!asDraft && selectedLeads.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          leadIds: selectedLeads,
          scheduledAt: formData.scheduledAt || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create campaign');
      }

      const campaign = await response.json();
      toast.success(
        asDraft ? 'Campaign saved as draft' : 'Campaign created successfully'
      );
      router.push(`/dashboard/campaigns/${campaign.id}`);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/campaigns">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h2 className="text-3xl font-bold tracking-tight">New Campaign</h2>
          </div>
          <p className="text-muted-foreground">
            Create and schedule your email campaign
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Draft
          </Button>
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Create Campaign
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Lead Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-none bg-primary text-primary-foreground text-sm">1</span>
                    Select Recipients
                  </CardTitle>
                  <CardDescription>Choose which leads to send this campaign to</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeadSelector(!showLeadSelector)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  {showLeadSelector ? 'Hide' : 'Show'} Leads
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showLeadSelector && (
                <div className="space-y-4">
                  {/* Info Alert */}
                  <Alert className="mb-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Showing only leads with email addresses
                    </AlertDescription>
                  </Alert>

                  {/* Filters */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {filterOptions?.statuses?.filter((s: any) => 
                          ['NEW', 'CONTACTED', 'RESPONDED', 'QUALIFIED'].includes(s.status)
                        ).map((s: any) => {
                          const icons: any = {
                            NEW: '🆕',
                            CONTACTED: '📧',
                            RESPONDED: '💬',
                            QUALIFIED: '✅',
                          };
                          return (
                            <SelectItem key={s.status} value={s.status}>
                              {icons[s.status]} {s.status} ({s.count})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                      <SelectTrigger>
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

                    <Select value={filterSource} onValueChange={setFilterSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        {filterOptions?.sources?.map((src: string) => {
                          const icons: any = {
                            'Google Places': '📍',
                            'Manual': '✍️',
                            'Import': '📥',
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

                  {/* Smart Selection Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={selectAllLeads}
                      disabled={leadsLoading}
                    >
                      Select All ({leadsData?.leads?.length || 0})
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => selectByStatus('QUALIFIED')}
                      disabled={leadsLoading}
                    >
                      ✅ Qualified Only
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => selectByStatus('RESPONDED')}
                      disabled={leadsLoading}
                    >
                      💬 Responded Only
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      disabled={selectedLeads.length === 0}
                    >
                      Clear ({selectedLeads.length})
                    </Button>
                  </div>

                  <Separator />

                  {leadsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : leadsData?.leads && leadsData.leads.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {leadsData.leads.map((lead: any) => (
                        <div
                          key={lead.id}
                          className="flex items-center space-x-2 p-3 rounded-none border hover:bg-accent cursor-pointer"
                          onClick={() => toggleLead(lead.id)}
                        >
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleLead(lead.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{lead.companyName}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {lead.email || 'No email'}
                              {lead.industry && ` • ${lead.industry}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No leads available. Please scrape some leads first.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Campaign Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-none bg-primary text-primary-foreground text-sm">2</span>
                    Campaign Details
                  </CardTitle>
                  <CardDescription>Write your email content and subject line</CardDescription>
                </div>
                <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedLeads.length === 0}
                      className="gap-2"
                    >
                      <Wand2 className="h-4 w-4" />
                      Generate with AI
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Generate Email with AI
                      </DialogTitle>
                      <DialogDescription>
                        Provide some context to help AI generate personalized email content for your {selectedLeads.length} selected recipient(s)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="yourCompany">Your Company Name</Label>
                        <Input
                          id="yourCompany"
                          placeholder="e.g., Acme Inc"
                          value={aiParams.yourCompany}
                          onChange={(e) => setAiParams({ ...aiParams, yourCompany: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="yourService">Your Product/Service</Label>
                        <Input
                          id="yourService"
                          placeholder="e.g., CRM Software for B2B Sales"
                          value={aiParams.yourService}
                          onChange={(e) => setAiParams({ ...aiParams, yourService: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="campaignGoal">Campaign Goal</Label>
                        <Input
                          id="campaignGoal"
                          placeholder="e.g., Book demo calls, Generate leads"
                          value={aiParams.campaignGoal}
                          onChange={(e) => setAiParams({ ...aiParams, campaignGoal: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tone">Email Tone</Label>
                        <Select
                          value={aiParams.tone}
                          onValueChange={(value: any) => setAiParams({ ...aiParams, tone: value })}
                        >
                          <SelectTrigger id="tone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={generateEmailWithAI}
                        disabled={generatingEmail || !aiParams.yourCompany || !aiParams.yourService}
                        className="w-full"
                      >
                        {generatingEmail ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Email
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Q4 Outreach Campaign"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Your compelling subject line"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailTemplate">Email Content *</Label>
                <Textarea
                  id="emailTemplate"
                  placeholder="Write your email content here... Use {{companyName}}, {{contactName}}, {{email}} as placeholders"
                  value={formData.emailTemplate}
                  onChange={(e) => handleInputChange('emailTemplate', e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Use placeholders: <code className="text-xs">{'{{companyName}}'}</code>,{' '}
                    <code className="text-xs">{'{{contactName}}'}</code>,{' '}
                    <code className="text-xs">{'{{email}}'}</code>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Sender Information */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-none bg-primary text-primary-foreground text-sm">3</span>
                  Sender Information
                </CardTitle>
                <CardDescription>Configure who the email is from</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name *</Label>
                  <Input
                    id="fromName"
                    placeholder="Your Name"
                    value={formData.fromName}
                    onChange={(e) => handleInputChange('fromName', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromEmail">From Email *</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.fromEmail}
                    onChange={(e) => handleInputChange('fromEmail', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="replyTo">Reply-To Email</Label>
                <Input
                  id="replyTo"
                  type="email"
                  placeholder="replies@company.com"
                  value={formData.replyTo}
                  onChange={(e) => handleInputChange('replyTo', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule
              </CardTitle>
              <CardDescription>When to send this campaign</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Send Date & Time</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => handleInputChange('scheduledAt', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to send immediately after creation
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Tips */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Campaign Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">✉️ Subject Lines</p>
                <p className="text-muted-foreground">
                  Keep it under 50 characters and personalize with placeholders
                </p>
              </div>
              <Separator />
              <div>
                <p className="font-medium">📝 Email Content</p>
                <p className="text-muted-foreground">
                  Use placeholders to personalize each email automatically
                </p>
              </div>
              <Separator />
              <div>
                <p className="font-medium">⏰ Timing</p>
                <p className="text-muted-foreground">
                  Best send times are Tuesday-Thursday, 10 AM - 2 PM
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

