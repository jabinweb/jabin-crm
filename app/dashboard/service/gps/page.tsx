'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function ServiceGpsPage() {
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [liveSnapshot, setLiveSnapshot] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [selectedTicket, setSelectedTicket] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const featureRes = await fetch('/api/features/me');
      if (featureRes.ok) {
        const featureData = await featureRes.json();
        if (featureData?.modules?.SERVICE_GPS === false) {
          setFeatureEnabled(false);
          setLoading(false);
          return;
        }
      }

      const [techRes, ticketsRes, liveRes, logsRes] = await Promise.all([
        fetch('/api/users/technicians'),
        fetch('/api/tickets'),
        fetch('/api/service/gps/live'),
        fetch('/api/service/gps'),
      ]);

      setTechnicians(techRes.ok ? await techRes.json() : []);
      setTickets(ticketsRes.ok ? await ticketsRes.json() : []);
      setLiveSnapshot(liveRes.ok ? await liveRes.json() : []);
      setLogs(logsRes.ok ? await logsRes.json() : []);
    } catch (error) {
      toast.error('Failed to load GPS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const checkInNow = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by browser');
      return;
    }

    setTracking(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch('/api/service/gps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              technicianId: selectedTechnician && selectedTechnician !== '__NONE__' ? selectedTechnician : undefined,
              ticketId: selectedTicket && selectedTicket !== '__NONE__' ? selectedTicket : undefined,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || undefined,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
              source: 'PWA',
            }),
          });

          if (!res.ok) throw new Error('Failed to submit location');
          toast.success('Location check-in recorded');
          loadData();
        } catch (error) {
          toast.error('Failed to submit location');
        } finally {
          setTracking(false);
        }
      },
      () => {
        toast.error('Unable to access location');
        setTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (loading) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8">Loading GPS tracking...</div>;
  }

  if (!featureEnabled) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader><CardTitle>Module Disabled</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            GPS Tracking is disabled by your Super Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">GPS Tracking</h1>
        <p className="text-sm text-muted-foreground">Track field movement and capture technician check-ins.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Technician Check-In</CardTitle>
          <CardDescription>Use browser GPS to save current location.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm mb-2">Technician (optional for managers)</p>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger><SelectValue placeholder="Use current technician session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">Current Logged-in Technician</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name || tech.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm mb-2">Ticket (optional)</p>
              <Select value={selectedTicket} onValueChange={setSelectedTicket}>
                <SelectTrigger><SelectValue placeholder="Select ticket context" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">No Ticket</SelectItem>
                  {tickets.map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>{ticket.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={checkInNow} disabled={tracking}>{tracking ? 'Capturing...' : 'Capture Current Location'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Live Snapshot</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Captured At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveSnapshot.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No recent GPS snapshots.</TableCell></TableRow>
                ) : (
                  liveSnapshot.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.technician?.name || row.technician?.email}</TableCell>
                      <TableCell>{row.latitude.toFixed(6)}</TableCell>
                      <TableCell>{row.longitude.toFixed(6)}</TableCell>
                      <TableCell>{row.accuracy ? `${Math.round(row.accuracy)}m` : '-'}</TableCell>
                      <TableCell>{new Date(row.capturedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Location Log</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No GPS logs yet.</TableCell></TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.capturedAt).toLocaleString()}</TableCell>
                      <TableCell>{log.technician?.name || log.technician?.email}</TableCell>
                      <TableCell>{log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}</TableCell>
                      <TableCell><Badge variant="outline">{log.source}</Badge></TableCell>
                      <TableCell>{log.ticket?.subject || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
