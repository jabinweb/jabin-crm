'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  SelectValue
} from '@/components/ui/select';
import { EmailDraftModal } from '@/components/email/email-draft-modal';
import { type useLeadsPage } from '@/hooks/use-leads-page';

type LeadsPageState = ReturnType<typeof useLeadsPage>;

interface LeadsDialogsProps extends Pick<
  LeadsPageState,
  | 'showEmailModal'
  | 'emailDrafts'
  | 'handleCloseEmailModal'
  | 'showAddLeadDialog'
  | 'setShowAddLeadDialog'
  | 'isAddingLead'
  | 'newLead'
  | 'setNewLead'
  | 'handleAddLead'
  | 'handleCancelAddLead'
  | 'showEnrollSequenceDialog'
  | 'setShowEnrollSequenceDialog'
  | 'selectedLeads'
  | 'selectedSequenceId'
  | 'setSelectedSequenceId'
  | 'sequences'
  | 'handleEnrollInSequence'
  | 'handleCancelEnrollSequence'
  | 'showCreateTaskDialog'
  | 'setShowCreateTaskDialog'
  | 'taskData'
  | 'setTaskData'
  | 'handleCreateTasksForLeads'
  | 'handleCancelCreateTask'
  | 'showCreateDealDialog'
  | 'setShowCreateDealDialog'
  | 'dealData'
  | 'setDealData'
  | 'handleCreateDealsForLeads'
  | 'handleCancelCreateDeal'
> {}

export function LeadsDialogs({
  showEmailModal,
  emailDrafts,
  handleCloseEmailModal,
  showAddLeadDialog,
  setShowAddLeadDialog,
  isAddingLead,
  newLead,
  setNewLead,
  handleAddLead,
  handleCancelAddLead,
  showEnrollSequenceDialog,
  setShowEnrollSequenceDialog,
  selectedLeads,
  selectedSequenceId,
  setSelectedSequenceId,
  sequences,
  handleEnrollInSequence,
  handleCancelEnrollSequence,
  showCreateTaskDialog,
  setShowCreateTaskDialog,
  taskData,
  setTaskData,
  handleCreateTasksForLeads,
  handleCancelCreateTask,
  showCreateDealDialog,
  setShowCreateDealDialog,
  dealData,
  setDealData,
  handleCreateDealsForLeads,
  handleCancelCreateDeal,
}: LeadsDialogsProps) {
  return (
    <>
      <EmailDraftModal
        open={showEmailModal}
        onClose={handleCloseEmailModal}
        drafts={emailDrafts}
      />

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
            <Button variant="outline" onClick={handleCancelAddLead}>
              Cancel
            </Button>
            <Button onClick={handleAddLead} disabled={isAddingLead || !newLead.companyName}>
              {isAddingLead ? 'Adding...' : 'Add Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="outline" onClick={handleCancelEnrollSequence}>
              Cancel
            </Button>
            <Button onClick={handleEnrollInSequence} disabled={!selectedSequenceId}>
              Enroll {selectedLeads.length} Lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button onClick={handleCreateTasksForLeads} disabled={!taskData.title}>
              Create {selectedLeads.length} Task(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button onClick={handleCreateDealsForLeads} disabled={!dealData.title}>
              Create {selectedLeads.length} Deal(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
