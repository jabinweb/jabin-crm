'use client';

import { type ChangeEvent, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { toast } from 'sonner';

const EMPTY_NEW_LEAD = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  industry: '',
  jobTitle: '',
  description: '',
};

const EMPTY_TASK_DATA = {
  title: '',
  type: 'CALL',
  priority: 'MEDIUM',
  dueDate: '',
};

const EMPTY_DEAL_DATA = {
  title: '',
  value: '',
  stage: 'DISCOVERY',
  probability: '50',
};

export function useLeadsPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
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
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [taskData, setTaskData] = useState(EMPTY_TASK_DATA);
  const [dealData, setDealData] = useState(EMPTY_DEAL_DATA);
  const [newLead, setNewLead] = useState(EMPTY_NEW_LEAD);
  const limit = 10;

  const { data: filterOptions } = useQuery({
    queryKey: ['lead-filters'],
    queryFn: async () => {
      const response = await fetch('/api/leads/filters');
      if (!response.ok) throw new Error('Failed to fetch filters');
      return response.json();
    },
  });

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
      const json = await response.json();
      return {
        leads: json.leads ?? json.data ?? [],
        pagination:
          json.pagination ??
          (json.meta
            ? {
                page: json.meta.page,
                limit: json.meta.limit,
                total: json.meta.total,
                pages: json.meta.pageCount,
              }
            : undefined),
      };
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

  const handleOpenImportPicker = () => {
    importInputRef.current?.click();
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      event.target.value = '';
      return;
    }

    setIsImporting(true);
    const loadingToastId = toast.loading('Importing leads from CSV...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/leads/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to import CSV');
      }

      toast.success(
        `Imported ${result.summary.imported} leads (skipped ${result.summary.skippedDuplicates + result.summary.skippedMissingCompany}, failed ${result.summary.failed})`,
        { id: loadingToastId }
      );
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-filters'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import CSV', { id: loadingToastId });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
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
    window.open(`/api/leads/export?format=csv&ids=${selectedLeads.join(',')}`, '_blank');
    toast.success(`Exporting ${selectedLeads.length} leads?`);
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to delete');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} leads?`)) return;

    try {
      await Promise.all(
        selectedLeads.map((leadId) =>
          fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
        )
      );
      toast.success(`Deleted ${selectedLeads.length} leads`);
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch {
      toast.error('Some leads could not be deleted');
    }
  };

  const handleConvertLead = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/convert`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Conversion failed');
      toast.success('Lead converted to customer');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (data.customerId) {
        router.push(path(`/dashboard/customers/${data.customerId}`));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert lead');
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
      setNewLead(EMPTY_NEW_LEAD);
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
      setTaskData(EMPTY_TASK_DATA);
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
      setDealData(EMPTY_DEAL_DATA);
      setSelectedLeads([]);
    } catch (error) {
      toast.error('Failed to create deals');
    }
  };

  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
    setEmailDrafts([]);
  };

  const handleCancelAddLead = () => {
    setShowAddLeadDialog(false);
    setNewLead(EMPTY_NEW_LEAD);
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
    search,
    setSearch,
    industry,
    setIndustry,
    source,
    setSource,
    status,
    setStatus,
    page,
    setPage,
    selectedLeads,
    showEmailModal,
    emailDrafts,
    isGeneratingEmail,
    showAddLeadDialog,
    setShowAddLeadDialog,
    isAddingLead,
    showEnrollSequenceDialog,
    setShowEnrollSequenceDialog,
    showCreateTaskDialog,
    setShowCreateTaskDialog,
    showCreateDealDialog,
    setShowCreateDealDialog,
    isImporting,
    selectedSequenceId,
    setSelectedSequenceId,
    importInputRef,
    taskData,
    setTaskData,
    dealData,
    setDealData,
    newLead,
    setNewLead,
    filterOptions,
    sequences,
    data,
    isLoading,
    error,
    path,
    router,
    handleExport,
    handleOpenImportPicker,
    handleImportCsv,
    handleSelectAll,
    handleSelectLead,
    handleBulkExport,
    handleBulkDelete,
    handleConvertLead,
    handleContactLead,
    handleBulkContact,
    handleStatusChange,
    handleAddLead,
    handleEnrollInSequence,
    handleCreateTasksForLeads,
    handleCreateDealsForLeads,
    handleCloseEmailModal,
    handleCancelAddLead,
    handleCancelEnrollSequence,
    handleCancelCreateTask,
    handleCancelCreateDeal,
  };
}
