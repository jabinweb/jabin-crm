'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { toast } from 'sonner';
import type {
  AiQualification,
  AiTaskSuggestion,
  AiTaskSuggestionsResponse,
  LeadActivityItem,
  LeadDetail,
  LeadDetailDealData,
  LeadDetailTaskData,
  LeadEmailSnapshot,
} from '@/types/lead';

const EMPTY_TASK_DATA: LeadDetailTaskData = {
  title: '',
  type: 'CALL',
  priority: 'MEDIUM',
  dueDate: '',
};

const EMPTY_DEAL_DATA: LeadDetailDealData = {
  title: '',
  value: '',
  stage: 'DISCOVERY',
  probability: '50',
};

export function useLeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const leadId = params.id as string;
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [aiScoring, setAiScoring] = useState(false);
  const [aiScore, setAiScore] = useState<AiQualification | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [showEnrollSequenceDialog, setShowEnrollSequenceDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<AiTaskSuggestionsResponse | null>(null);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [taskData, setTaskData] = useState<LeadDetailTaskData>(EMPTY_TASK_DATA);
  const [dealData, setDealData] = useState<LeadDetailDealData>(EMPTY_DEAL_DATA);

  const { data: sequences } = useQuery({
    queryKey: ['sequences'],
    queryFn: async () => {
      const response = await fetch('/api/sequences');
      if (!response.ok) throw new Error('Failed to fetch sequences');
      return response.json();
    },
  });

  const { data: lead, isLoading } = useQuery<LeadDetail>({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${leadId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lead details');
      }
      return response.json();
    },
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<LeadActivityItem[]>({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${leadId}/activities`);
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      return response.json();
    },
  });

  const { data: emailSnapshot, isLoading: emailsLoading } = useQuery<LeadEmailSnapshot[]>({
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
    } catch {
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
      setTaskData(EMPTY_TASK_DATA);
    } catch {
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
      setDealData(EMPTY_DEAL_DATA);
    } catch {
      toast.error('Failed to create deal');
    }
  };

  const handleGetAISuggestions = async () => {
    setLoadingAiSuggestions(true);
    toast.loading('AI is analyzing this lead...', { id: 'ai-suggestions' });

    try {
      const response = await fetch('/api/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, maxSuggestions: 3 }),
      });

      if (!response.ok) throw new Error('Failed to get AI suggestions');

      const data: AiTaskSuggestionsResponse = await response.json();
      setAiSuggestions(data);
      toast.success('AI suggestions ready!', { id: 'ai-suggestions' });
    } catch {
      toast.error('Failed to get AI suggestions', { id: 'ai-suggestions' });
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  const handleCreateTaskFromAI = async (suggestion: AiTaskSuggestion) => {
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
      setAiSuggestions(null);
    } catch {
      toast.error('Failed to create task');
    }
  };

  const handleAIScoring = async () => {
    if (!lead) return;

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
    } catch (error) {
      console.error('Error scoring lead:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to score lead');
    } finally {
      setAiScoring(false);
    }
  };

  const handleConvertLead = async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Conversion failed');
      toast.success('Lead converted to customer');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      if (data.customerId) router.push(path(`/dashboard/customers/${data.customerId}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to convert');
    }
  };

  const handleCancelEnrollSequence = () => {
    setShowEnrollSequenceDialog(false);
    setSelectedSequenceId('');
  };

  const handleCancelCreateTask = () => {
    setShowCreateTaskDialog(false);
    setTaskData(EMPTY_TASK_DATA);
  };

  const handleCancelCreateDeal = () => {
    setShowCreateDealDialog(false);
    setDealData(EMPTY_DEAL_DATA);
  };

  return {
    leadId,
    lead,
    isLoading,
    activities,
    activitiesLoading,
    emailSnapshot,
    emailsLoading,
    sequences,
    note,
    setNote,
    isAddingNote,
    setIsAddingNote,
    aiScoring,
    aiScore,
    composeOpen,
    setComposeOpen,
    showEnrollSequenceDialog,
    setShowEnrollSequenceDialog,
    showCreateTaskDialog,
    setShowCreateTaskDialog,
    showCreateDealDialog,
    setShowCreateDealDialog,
    selectedSequenceId,
    setSelectedSequenceId,
    aiSuggestions,
    setAiSuggestions,
    loadingAiSuggestions,
    taskData,
    setTaskData,
    dealData,
    setDealData,
    addNoteMutation,
    handleAddNote,
    handleEnrollInSequence,
    handleCreateTask,
    handleCreateDeal,
    handleGetAISuggestions,
    handleCreateTaskFromAI,
    handleAIScoring,
    handleConvertLead,
    handleCancelEnrollSequence,
    handleCancelCreateTask,
    handleCancelCreateDeal,
  };
}
