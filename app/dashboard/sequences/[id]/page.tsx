'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Users, Mail, TrendingUp, Play, Pause, Edit } from 'lucide-react';
import Link from 'next/link';

interface SequenceStats {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: Array<{
    id: string;
    stepNumber: number;
    name: string;
    subject: string;
  }>;
  enrollments: {
    total: number;
    active: number;
    completed: number;
    stopped: number;
    paused: number;
  };
}

export default function SequenceDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [stats, setStats] = useState<SequenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchAvailableLeads();
  }, [params.id]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/sequences/${params.id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableLeads = async () => {
    try {
      const res = await fetch('/api/leads?limit=100');
      if (res.ok) {
        const data = await res.json();
        setAvailableLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    }
  };

  const toggleSequence = async () => {
    if (!stats) return;
    
    try {
      const res = await fetch(`/api/sequences/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !stats.isActive }),
      });

      if (res.ok) {
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to toggle sequence:', error);
    }
  };

  const enrollLeads = async () => {
    try {
      const res = await fetch(`/api/sequences/${params.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeads }),
      });

      if (res.ok) {
        setShowEnrollDialog(false);
        setSelectedLeads([]);
        fetchStats();
        alert('Leads enrolled successfully!');
      }
    } catch (error) {
      console.error('Failed to enroll leads:', error);
      alert('Failed to enroll leads');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8">Loading...</div>;
  }

  if (!stats) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8">Sequence not found</div>;
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sequences">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{stats.name}</h1>
              <Badge variant={stats.isActive ? 'default' : 'secondary'}>
                {stats.isActive ? 'Active' : 'Paused'}
              </Badge>
            </div>
            <p className="text-muted-foreground">{stats.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEnrollDialog(true)}>
            <Users className="mr-2 h-4 w-4" />
            Enroll Leads
          </Button>
          <Button variant={stats.isActive ? 'secondary' : 'default'} onClick={toggleSequence}>
            {stats.isActive ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolled</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enrollments.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enrollments.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enrollments.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stopped</CardTitle>
            <Badge variant="secondary">{stats.enrollments.stopped}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enrollments.stopped}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sequence Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Sequence Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-4 p-4 border rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                  {step.stepNumber}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{step.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{step.subject}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enroll Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enroll Leads in Sequence</DialogTitle>
            <DialogDescription>
              Select leads to enroll in this email sequence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {availableLeads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No leads available</p>
            ) : (
              availableLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => {
                    setSelectedLeads((prev) =>
                      prev.includes(lead.id)
                        ? prev.filter((id) => id !== lead.id)
                        : [...prev, lead.id]
                    );
                  }}
                >
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedLeads([...selectedLeads, lead.id]);
                      } else {
                        setSelectedLeads(selectedLeads.filter((id) => id !== lead.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{lead.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {lead.email} {lead.contactName && `• ${lead.contactName}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>
              Cancel
            </Button>
            <Button onClick={enrollLeads} disabled={selectedLeads.length === 0}>
              Enroll {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
