'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Globe,
  Building,
  MapPin,
  Calendar,
  ExternalLink,
  Linkedin,
  User,
  Briefcase,
  FileText,
  Plus,
  Sparkles,
  TrendingUp,
  Loader2,
  ListChecks,
  Target
} from 'lucide-react';
import { EmailComposeDialog } from '@/components/email/email-compose-dialog';
import { LeadScoreBadge } from '@/components/crm/lead-score-badge';
import { format } from 'date-fns';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [aiScoring, setAiScoring] = useState(false);
  const [aiScore, setAiScore] = useState<any>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [showEnrollSequenceDialog, setShowEnrollSequenceDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
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

  // Fetch available sequences
  const { data: sequences } = useQuery({
    queryKey: ['sequences'],
    queryFn: async () => {
      const response = await fetch('/api/sequences');
      if (!response.ok) throw new Error('Failed to fetch sequences');
      return response.json();
    },
  });

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${leadId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lead details');
      }
      return response.json();
    },
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${leadId}/activities`);
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      return response.json();
    },
  });

  const { data: emailSnapshot, isLoading: emailsLoading } = useQuery({
    queryKey: ['lead-emails', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${leadId}/emails`);
      if (!response.ok) {
        throw new Error('Failed to fetch lead emails');
      }
      const data = await response.json();
      return data.emails || [];
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText }),
      });
      if (!response.ok) {
        throw new Error('Failed to add note');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Note added successfully');
      setNote('');
      setIsAddingNote(false);
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
    },
    onError: () => {
      toast.error('Failed to add note');
    },
  });

  const handleAddNote = () => {
    if (!note.trim()) {
      toast.error('Please enter a note');
      return;
    }
    addNoteMutation.mutate(note);
  };

  const handleEnrollInSequence = async () => {
    if (!selectedSequenceId) {
      toast.error('Please select a sequence');
      return;
    }

    try {
      const response = await fetch(`/api/sequences/${selectedSequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId] }),
      });

      if (!response.ok) throw new Error('Failed to enroll lead');

      toast.success('Lead enrolled in sequence!');
      setShowEnrollSequenceDialog(false);
      setSelectedSequenceId('');
    } catch (error) {
      toast.error('Failed to enroll lead in sequence');
    }
  };

  const handleCreateTask = async () => {
    if (!taskData.title) {
      toast.error('Task title is required');
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskData,
          leadId,
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');

      toast.success('Task created!');
      setShowCreateTaskDialog(false);
      setTaskData({ title: '', type: 'CALL', priority: 'MEDIUM', dueDate: '' });
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleCreateDeal = async () => {
    if (!dealData.title) {
      toast.error('Deal title is required');
      return;
    }

    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dealData,
          leadId,
          value: parseFloat(dealData.value) || 0,
          probability: parseInt(dealData.probability) || 50,
        }),
      });

      if (!response.ok) throw new Error('Failed to create deal');

      toast.success('Deal created!');
      setShowCreateDealDialog(false);
      setDealData({ title: '', value: '', stage: 'DISCOVERY', probability: '50' });
    } catch (error) {
      toast.error('Failed to create deal');
    }
  };

  const handleGetAISuggestions = async () => {
    setLoadingAiSuggestions(true);
    toast.loading('🤖 AI is analyzing this lead...', { id: 'ai-suggestions' });

    try {
      const response = await fetch('/api/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, maxSuggestions: 3 }),
      });

      if (!response.ok) throw new Error('Failed to get AI suggestions');

      const data = await response.json();
      setAiSuggestions(data);
      toast.success('✨ AI suggestions ready!', { id: 'ai-suggestions' });
    } catch (error) {
      toast.error('Failed to get AI suggestions', { id: 'ai-suggestions' });
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  const handleCreateTaskFromAI = async (suggestion: any) => {
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + suggestion.dueInDays);

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          type: suggestion.type,
          priority: suggestion.priority,
          dueDate,
          description: suggestion.description,
          leadId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');

      toast.success('Task created from AI suggestion!');
      setAiSuggestions(null); // Clear suggestions after use
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleAIScoring = async () => {
    setAiScoring(true);
    try {
      const response = await fetch('/api/ai/qualify-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: lead.companyName,
          industry: lead.industry,
          website: lead.website,
          email: lead.email,
          phone: lead.phone,
          revenue: lead.revenue,
          employeeCount: lead.employeeCount,
          description: lead.description,
          source: lead.source,
        }),
      });

      if (!response.ok) throw new Error('Failed to score lead');

      const data = await response.json();
      setAiScore(data.qualification);
      toast.success(`Lead Score: ${data.qualification.score}/100 - ${data.qualification.quality}`);
    } catch (error: any) {
      console.error('Error scoring lead:', error);
      toast.error(error.message || 'Failed to score lead');
    } finally {
      setAiScoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 space-y-4">
        <div className="text-center py-8">
          <p className="text-red-500">Lead not found</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/leads">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Leads
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 pb-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/leads">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {lead.companyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{lead.companyName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {lead.contactName && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {lead.contactName}
                        {lead.jobTitle && ` • ${lead.jobTitle}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Quick Contact Info */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {lead.email && (
                  <a 
                    href={`mailto:${lead.email}`}
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    <Mail className="h-4 w-4" />
                    {lead.email}
                  </a>
                )}
                {lead.phone && (
                  <a 
                    href={`tel:${lead.phone}`}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-700 hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {lead.phone}
                  </a>
                )}
                {lead.website && (
                  <a 
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-700 hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {lead.leadScore && (
              <LeadScoreBadge 
                score={lead.leadScore.score} 
                showNumber={true}
                size="lg"
              />
            )}
            <Badge 
              className="text-sm px-3 py-1"
              variant={
                lead.status === 'CONVERTED' ? 'default' :
                lead.status === 'QUALIFIED' ? 'default' :
                lead.status === 'RESPONDED' ? 'secondary' :
                lead.status === 'CONTACTED' ? 'secondary' :
                lead.status === 'LOST' ? 'destructive' :
                lead.status === 'UNSUBSCRIBED' ? 'destructive' :
                'outline'
              }
            >
              {lead.status}
            </Badge>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)} className="gap-2">
                <Mail className="h-4 w-4" />
                Send Email
              </Button>
              {lead.phone && (
                <Button size="sm" variant="outline" asChild className="gap-2">
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="h-4 w-4" />
                    Call
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowEnrollSequenceDialog(true)} className="gap-2">
                <Mail className="h-4 w-4" />
                Enroll in Sequence
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreateTaskDialog(true)} className="gap-2">
                <ListChecks className="h-4 w-4" />
                Create Task
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreateDealDialog(true)} className="gap-2">
                <Target className="h-4 w-4" />
                Create Deal
              </Button>
              {lead.status !== 'CONVERTED' && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-2"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/leads/${leadId}/convert`, { method: 'POST' });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error || 'Conversion failed');
                      toast.success('Lead converted to customer');
                      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
                      if (data.customerId) router.push(`/dashboard/customers/${data.customerId}`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to convert');
                    }
                  }}
                >
                  <Building className="h-4 w-4" />
                  Convert to Customer
                </Button>
              )}
              {lead.linkedinUrl && (
                <Button size="sm" variant="outline" asChild>
                  <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Information */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {lead.industry && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Industry</p>
                    <Badge variant="outline" className="font-normal">{lead.industry}</Badge>
                  </div>
                )}

                {lead.employeeCount && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Size</p>
                    <p className="text-sm font-semibold">{lead.employeeCount} employees</p>
                  </div>
                )}

                {lead.address && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</p>
                    <p className="text-sm flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {lead.address}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Added</p>
                  <p className="text-sm flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {format(new Date(lead.createdAt), 'PP')}
                  </p>
                </div>
              </div>

              {lead.description && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{lead.description}</p>
                </div>
              )}

              {lead.sourceUrl && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Source</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="font-normal">{lead.source}</Badge>
                    <a 
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View Source
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Task Suggestions */}
          {aiSuggestions ? (
            <Card className="border-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    AI Task Suggestions
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiSuggestions(null)}
                  >
                    Dismiss
                  </Button>
                </div>
                <CardDescription className="text-sm mt-2">
                  {aiSuggestions.insights}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiSuggestions.suggestions.map((suggestion: any, index: number) => (
                  <div key={index} className="bg-white dark:bg-slate-900 rounded-lg p-4 space-y-2 border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={
                            suggestion.priority === 'URGENT' ? 'destructive' :
                            suggestion.priority === 'HIGH' ? 'default' :
                            'secondary'
                          } className="text-xs">
                            {suggestion.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {suggestion.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Due in {suggestion.dueInDays} {suggestion.dueInDays === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{suggestion.reasoning}</p>
                        {suggestion.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 italic">
                            {suggestion.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateTaskFromAI(suggestion)}
                        className="shrink-0"
                      >
                        Create Task
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-dashed">
              <CardContent className="py-8 text-center">
                <Button
                  onClick={handleGetAISuggestions}
                  disabled={loadingAiSuggestions}
                  className="gap-2"
                  variant="outline"
                >
                  {loadingAiSuggestions ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Get AI Task Suggestions
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  AI will analyze this lead and suggest next best actions
                </p>
              </CardContent>
            </Card>
          )}

          {/* AI Lead Score */}
          <Card className="border-2 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  AI Lead Score
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAIScoring}
                  disabled={aiScoring}
                  className="bg-white dark:bg-slate-900"
                >
                  {aiScoring ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="mr-2 h-3 w-3" />
                      {aiScore ? 'Refresh' : 'Analyze'}
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                AI-powered lead qualification and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!aiScore ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-3">
                    <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click "Analyze" to get AI-powered lead insights
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Lead Quality</p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            aiScore.quality === 'HOT' ? 'default' :
                            aiScore.quality === 'WARM' ? 'secondary' :
                            'outline'
                          }
                          className="text-base font-bold px-3 py-1"
                        >
                          {aiScore.quality}
                        </Badge>
                        <span className="text-2xl font-bold">{aiScore.score}<span className="text-sm text-muted-foreground">/100</span></span>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Conversion Probability</p>
                      <p className="text-3xl font-bold text-green-600">{aiScore.conversionProbability}%</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Analysis</p>
                    <p className="text-sm leading-relaxed">{aiScore.reasoning}</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Recommended Next Steps</p>
                    <ul className="space-y-2">
                      {aiScore.nextSteps.map((step: string, idx: number) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  Activity Timeline
                </CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  variant={isAddingNote ? "secondary" : "outline"}
                >
                  <Plus className="h-3 w-3 mr-2" />
                  {isAddingNote ? 'Cancel' : 'Add Note'}
                </Button>
              </div>
              <CardDescription>
                Track all interactions and changes with this lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAddingNote && (
                <div className="mb-6 space-y-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                  <Textarea
                    placeholder="Add a note about this lead..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="bg-white dark:bg-slate-950"
                  />
                  <Button 
                    onClick={handleAddNote}
                    disabled={addNoteMutation.isPending}
                    size="sm"
                  >
                    {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
              )}
              {activitiesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity: any) => (
                    <div key={activity.id} className="flex gap-3 pb-3 border-b last:border-b-0">
                      <div className="mt-0.5">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-base">
                          {activity.activityType === 'CREATED' && '🆕'}
                          {activity.activityType === 'STATUS_CHANGED' && '🔄'}
                          {activity.activityType === 'EMAIL_SENT' && '📧'}
                          {activity.activityType === 'EMAIL_OPENED' && '👁️'}
                          {activity.activityType === 'EMAIL_CLICKED' && '🖱️'}
                          {activity.activityType === 'EMAIL_REPLIED' && '💬'}
                          {activity.activityType === 'NOTE_ADDED' && '📝'}
                          {activity.activityType === 'TAG_ADDED' && '🏷️'}
                          {activity.activityType === 'ENRICHED' && '✨'}
                          {activity.activityType === 'CONTACTED' && '📞'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">
                            {activity.activityType === 'CREATED' && 'Lead Created'}
                            {activity.activityType === 'STATUS_CHANGED' && 'Status Changed'}
                            {activity.activityType === 'EMAIL_SENT' && 'Email Sent'}
                            {activity.activityType === 'EMAIL_OPENED' && 'Email Opened'}
                            {activity.activityType === 'EMAIL_CLICKED' && 'Email Link Clicked'}
                            {activity.activityType === 'EMAIL_REPLIED' && 'Email Replied'}
                            {activity.activityType === 'NOTE_ADDED' && 'Note Added'}
                            {activity.activityType === 'TAG_ADDED' && 'Tag Added'}
                            {activity.activityType === 'ENRICHED' && 'Lead Enriched'}
                            {activity.activityType === 'CONTACTED' && 'Contacted'}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                        {activity.metadata && activity.activityType === 'STATUS_CHANGED' && (
                          <div className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mt-2 inline-block">
                            {activity.metadata.oldStatus} → {activity.metadata.newStatus}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No activities yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Email Conversations */}
          <Card className="border-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                Email Conversations
              </CardTitle>
              <CardDescription>Recent emails and reply activity</CardDescription>
            </CardHeader>
            <CardContent>
              {emailsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              ) : emailSnapshot && emailSnapshot.length > 0 ? (
                <div className="space-y-3">
                  {emailSnapshot.map((em: any) => (
                    <div key={em.id} className="bg-white dark:bg-slate-900 rounded-lg p-3 border hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm line-clamp-1 flex-1">{em.subject || '(No subject)'}</h4>
                        {em.replyCount > 0 && (
                          <Badge variant="default" className="shrink-0 bg-green-600">
                            {em.replyCount} {em.replyCount === 1 ? 'reply' : 'replies'}
                          </Badge>
                        )}
                      </div>
                      
                      {em.latestReply?.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          <span className="font-medium">Latest: </span>
                          {em.latestReply.body}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {em.sentAt ? format(new Date(em.sentAt), 'MMM d, h:mm a') : ''}
                        </span>
                        <Link 
                          href={`/dashboard/emails?search=${encodeURIComponent(em.subject || '')}`}
                          className="text-green-600 hover:text-green-700 hover:underline font-medium"
                        >
                          View Thread →
                        </Link>
                      </div>
                    </div>
                  ))}
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2 bg-white dark:bg-slate-900"
                    onClick={() => setComposeOpen(true)}
                  >
                    <Mail className="h-3 w-3 mr-2" />
                    Send New Email
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                    <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">No emails sent yet</p>
                  <Button 
                    size="sm" 
                    onClick={() => setComposeOpen(true)}
                    className="bg-gradient-to-r from-green-500 to-emerald-500"
                  >
                    <Mail className="h-3 w-3 mr-2" />
                    Start Conversation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={{ to: lead.email || '', subject: `Follow up: ${lead.companyName}` }}
      />

      {/* Enroll in Sequence Dialog */}
      <Dialog open={showEnrollSequenceDialog} onOpenChange={setShowEnrollSequenceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll in Sequence</DialogTitle>
            <DialogDescription>
              Enroll {lead.companyName} in an automated email sequence.
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
              Enroll Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Create a task for {lead.companyName}.
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
            <Button onClick={handleCreateTask} disabled={!taskData.title}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Deal Dialog */}
      <Dialog open={showCreateDealDialog} onOpenChange={setShowCreateDealDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Deal</DialogTitle>
            <DialogDescription>
              Create a deal for {lead.companyName}.
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
            <Button onClick={handleCreateDeal} disabled={!dealData.title}>
              Create Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
