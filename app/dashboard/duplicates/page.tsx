'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Loader2, 
  Check, 
  X,
  AlertTriangle,
  Copy,
  Merge,
  Trash2,
  RefreshCw,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DuplicatesPage() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeStrategy, setMergeStrategy] = useState<string>('keep-most-complete');
  const [selectedDuplicates, setSelectedDuplicates] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lead-duplicates'],
    queryFn: async () => {
      const response = await fetch('/api/leads/duplicates');
      if (!response.ok) throw new Error('Failed to fetch duplicates');
      return response.json();
    },
  });

  const autoMergeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/leads/auto-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exactMatchOnly: true }),
      });
      if (!response.ok) throw new Error('Failed to auto-merge');
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Auto-merged ${data.mergedCount} duplicates in ${data.groupsProcessed} groups`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to auto-merge duplicates');
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryLeadId, duplicateLeadIds }: any) => {
      const response = await fetch('/api/leads/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryLeadId,
          duplicateLeadIds,
          strategy: mergeStrategy,
        }),
      });
      if (!response.ok) throw new Error('Failed to merge leads');
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setShowMergeDialog(false);
      setSelectedGroup(null);
      setSelectedDuplicates([]);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to merge leads');
    },
  });

  const handleSelectDuplicate = (leadId: string) => {
    setSelectedDuplicates(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleMergeGroup = (group: any) => {
    setSelectedGroup(group);
    setSelectedDuplicates(group.duplicates.map((d: any) => d.id));
    setShowMergeDialog(true);
  };

  const handleConfirmMerge = () => {
    if (!selectedGroup || selectedDuplicates.length === 0) return;

    mergeMutation.mutate({
      primaryLeadId: selectedGroup.primaryLead.id,
      duplicateLeadIds: selectedDuplicates,
    });
  };

  const getMatchTypeBadge = (matchType: string) => {
    const variants: any = {
      exact: 'destructive',
      similar: 'default',
      fuzzy: 'secondary',
    };

    return (
      <Badge variant={variants[matchType] || 'secondary'}>
        {matchType === 'exact' ? 'Exact Match' : matchType === 'similar' ? 'Similar' : 'Fuzzy Match'}
      </Badge>
    );
  };

  const groups = data?.groups || [];
  const summary = data?.summary || null;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Duplicate Leads</h1>
          <p className="text-muted-foreground">
            Identify and merge duplicate leads to keep your database clean
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => autoMergeMutation.mutate()}
            disabled={autoMergeMutation.isPending || !summary?.exactMatches}
          >
            {autoMergeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Merge className="mr-2 h-4 w-4" />
            )}
            Auto-Merge Exact Matches
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
              <Copy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalGroups}</div>
              <p className="text-xs text-muted-foreground">
                Duplicate lead groups found
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Duplicates</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalDuplicates}</div>
              <p className="text-xs text-muted-foreground">
                Duplicate leads detected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Exact Matches</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.exactMatches}</div>
              <p className="text-xs text-muted-foreground">
                High confidence duplicates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Similar Matches</CardTitle>
              <Info className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.similarMatches}</div>
              <p className="text-xs text-muted-foreground">
                Review recommended
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Check className="mb-4 h-12 w-12 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">No Duplicates Found</h3>
            <p className="text-center text-muted-foreground">
              Your lead database is clean! No duplicate leads were detected.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group: any) => (
            <Card key={group.primaryLead.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {group.primaryLead.companyName}
                      {getMatchTypeBadge(group.matchType)}
                    </CardTitle>
                    <CardDescription>
                      {group.totalMatches} duplicate{group.totalMatches > 1 ? 's' : ''} found
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleMergeGroup(group)} size="sm">
                    <Merge className="mr-2 h-4 w-4" />
                    Merge
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Primary Lead */}
                  <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">Primary Lead</Badge>
                      <span className="text-xs text-muted-foreground">
                        Created: {new Date(group.primaryLead.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Company:</span> {group.primaryLead.companyName}
                      </div>
                      <div>
                        <span className="font-medium">Email:</span> {group.primaryLead.email || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Phone:</span> {group.primaryLead.phone || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Website:</span> {group.primaryLead.website || 'N/A'}
                      </div>
                      {group.primaryLead.city && (
                        <div>
                          <span className="font-medium">Location:</span> {group.primaryLead.city}, {group.primaryLead.state || group.primaryLead.country}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Status:</span> {group.primaryLead.status}
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Leads */}
                  {group.duplicates.map((duplicate: any) => (
                    <div key={duplicate.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="secondary">Duplicate</Badge>
                        <span className="text-xs text-muted-foreground">
                          Created: {new Date(duplicate.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Company:</span> {duplicate.companyName}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {duplicate.email || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {duplicate.phone || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Website:</span> {duplicate.website || 'N/A'}
                        </div>
                        {duplicate.city && (
                          <div>
                            <span className="font-medium">Location:</span> {duplicate.city}, {duplicate.state || duplicate.country}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Status:</span> {duplicate.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Merge Dialog */}
      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Duplicate Leads</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge {selectedDuplicates.length} duplicate lead(s) into the primary lead. 
              All activities and campaign associations will be transferred.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Merge Strategy</label>
              <Select value={mergeStrategy} onValueChange={setMergeStrategy}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep-most-complete">
                    Keep Most Complete Data
                  </SelectItem>
                  <SelectItem value="keep-primary">
                    Keep Primary Lead Data
                  </SelectItem>
                  <SelectItem value="keep-newest">
                    Keep Newest Data
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                {mergeStrategy === 'keep-most-complete' && 
                  'Combines the most detailed information from all leads'}
                {mergeStrategy === 'keep-primary' && 
                  'Preserves data from the primary lead, only filling in missing fields'}
                {mergeStrategy === 'keep-newest' && 
                  'Uses the most recently created data when conflicts occur'}
              </p>
            </div>

            {selectedGroup && (
              <div className="rounded-lg bg-muted p-4">
                <div className="mb-2 text-sm font-medium">Primary Lead</div>
                <div className="text-sm">
                  {selectedGroup.primaryLead.companyName} • {selectedGroup.primaryLead.email || 'No email'}
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMerge}
              disabled={mergeMutation.isPending}
              className="bg-primary"
            >
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="mr-2 h-4 w-4" />
                  Merge Leads
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
