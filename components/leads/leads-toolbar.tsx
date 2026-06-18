'use client';

import { type ChangeEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Mail, Plus, Upload } from 'lucide-react';
import { type useLeadsPage } from '@/hooks/use-leads-page';

type LeadsPageState = ReturnType<typeof useLeadsPage>;

interface LeadsToolbarProps extends Pick<
  LeadsPageState,
  | 'selectedLeads'
  | 'isGeneratingEmail'
  | 'isImporting'
  | 'importInputRef'
  | 'handleImportCsv'
  | 'handleBulkContact'
  | 'setShowEnrollSequenceDialog'
  | 'setShowCreateTaskDialog'
  | 'setShowCreateDealDialog'
  | 'handleBulkExport'
  | 'handleBulkDelete'
  | 'setShowAddLeadDialog'
  | 'handleOpenImportPicker'
  | 'handleExport'
> {}

export function LeadsToolbar({
  selectedLeads,
  isGeneratingEmail,
  isImporting,
  importInputRef,
  handleImportCsv,
  handleBulkContact,
  setShowEnrollSequenceDialog,
  setShowCreateTaskDialog,
  setShowCreateDealDialog,
  handleBulkExport,
  handleBulkDelete,
  setShowAddLeadDialog,
  handleOpenImportPicker,
  handleExport,
}: LeadsToolbarProps) {
  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportCsv}
      />

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
          <Button variant="outline" onClick={handleOpenImportPicker} size="sm" disabled={isImporting}>
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? 'Importing...' : 'Import CSV'}
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
    </>
  );
}
