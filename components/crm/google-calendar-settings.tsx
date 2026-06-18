'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, CheckCircle, XCircle, RefreshCw, Download, Upload } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export function GoogleCalendarSettings() {
  const { toast } = useToast();
  const { path } = useWorkspacePaths();
  const [status, setStatus] = useState<{
    connected: boolean;
    hasTokens: boolean;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/calendar/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check calendar status:', error);
    }
  };

  const handleConnect = async () => {
    try {
      await signIn('google', {
        callbackUrl: path('/dashboard/settings/calendar'),
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect Google Calendar',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: now.toISOString(),
          endDate: thirtyDaysLater.toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: `Imported ${data.imported} events from Google Calendar`,
        });
      } else {
        throw new Error('Import failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to import from Google Calendar',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar Integration
            </CardTitle>
            <CardDescription>
              Sync your CRM events with Google Calendar
            </CardDescription>
          </div>
          {status?.connected ? (
            <Badge className="bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.connected ? (
          <div className="text-center py-6">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 mb-4">
              Connect your Google account to enable two-way calendar sync
            </p>
            <Button onClick={handleConnect}>
              <Calendar className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-none bg-green-50">
              <div>
                <p className="font-medium">Calendar sync is active</p>
                <p className="text-sm text-gray-600">
                  Events created in the CRM will automatically sync to Google Calendar
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Import Events
              </Button>
              <Button variant="outline" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Auto-sync Enabled
              </Button>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p className="font-medium">How it works:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Events created in CRM are automatically pushed to Google Calendar</li>
                <li>Import existing Google Calendar events to CRM</li>
                <li>Updates in CRM sync to Google Calendar</li>
                <li>Deletion in CRM removes from Google Calendar</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

