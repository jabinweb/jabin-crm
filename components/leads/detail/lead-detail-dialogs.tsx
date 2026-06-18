'use client';

import { Button } from '@/components/ui/button';
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
import { EmailComposeDialog } from '@/components/email/email-compose-dialog';
import { type useLeadDetailPage } from '@/hooks/use-lead-detail-page';

type LeadDetailPageState = ReturnType<typeof useLeadDetailPage>;

interface LeadDetailDialogsProps extends Pick<
  LeadDetailPageState,
  | 'lead'
  | 'composeOpen'
  | 'setComposeOpen'
  | 'showEnrollSequenceDialog'
  | 'setShowEnrollSequenceDialog'
  | 'selectedSequenceId'
  | 'setSelectedSequenceId'
  | 'sequences'
  | 'handleEnrollInSequence'
  | 'handleCancelEnrollSequence'
  | 'showCreateTaskDialog'
  | 'setShowCreateTaskDialog'
  | 'taskData'
  | 'setTaskData'
  | 'handleCreateTask'
  | 'handleCancelCreateTask'
  | 'showCreateDealDialog'
  | 'setShowCreateDealDialog'
  | 'dealData'
  | 'setDealData'
  | 'handleCreateDeal'
  | 'handleCancelCreateDeal'
> {}

export function LeadDetailDialogs({
  lead,
  composeOpen,
  setComposeOpen,
  showEnrollSequenceDialog,
  setShowEnrollSequenceDialog,
  selectedSequenceId,
  setSelectedSequenceId,
  sequences,
  handleEnrollInSequence,
  handleCancelEnrollSequence,
  showCreateTaskDialog,
  setShowCreateTaskDialog,
  taskData,
  setTaskData,
  handleCreateTask,
  handleCancelCreateTask,
  showCreateDealDialog,
  setShowCreateDealDialog,
  dealData,
  setDealData,
  handleCreateDeal,
  handleCancelCreateDeal,
}: LeadDetailDialogsProps) {
  if (!lead) return null;

  return (
    <>
      <EmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={{ to: lead.email || '', subject: `Follow up: ${lead.companyName}` }}
      />

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
                  {sequences?.sequences?.filter((seq: { isActive: boolean }) => seq.isActive).map((seq: { id: string; name: string; _count?: { enrollments?: number } }) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      {seq.name} ({seq._count?.enrollments || 0} enrolled)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEnrollSequence}>
              Cancel
            </Button>
            <Button onClick={handleEnrollInSequence} disabled={!selectedSequenceId}>
              Enroll Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <SelectItem value="EMAIL">📧 Email</SelectItem>
                    <SelectItem value="MEETING">🤝 Meeting</SelectItem>
                    <SelectItem value="FOLLOW_UP">🔄 Follow-up</SelectItem>
                    <SelectItem value="TODO">✅ To-do</SelectItem>
                    <SelectItem value="DEMO">🎯 Demo</SelectItem>
                    <SelectItem value="PROPOSAL">📄 Proposal</SelectItem>
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
            <Button variant="outline" onClick={handleCancelCreateTask}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!taskData.title}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <SelectItem value="PROPOSAL">📄 Proposal</SelectItem>
                  <SelectItem value="NEGOTIATION">🤝 Negotiation</SelectItem>
                  <SelectItem value="CLOSED_WON">🎉 Closed Won</SelectItem>
                  <SelectItem value="CLOSED_LOST">❌ Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCreateDeal}>
              Cancel
            </Button>
            <Button onClick={handleCreateDeal} disabled={!dealData.title}>
              Create Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
