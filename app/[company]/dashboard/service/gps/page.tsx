'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function mapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function MapLink({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <a
      href={mapsUrl(latitude, longitude)}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Google Maps"
      aria-label="Open in Google Maps"
      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <MapPin className="h-4 w-4" />
    </a>
  );
}

export default function ServiceGpsPage() {
  const { data: session } = useSession();
  const isTechnician = session?.user?.role === 'TECHNICIAN';
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [liveSnapshot, setLiveSnapshot] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [selectedTicket, setSelectedTicket] = useState('__NONE__');

  useEffect(() => {
    if (isTechnician) {
      setSelectedTechnician((current) => (current ? current : '__NONE__'));
    }
  }, [isTechnician]);

  const loadData = async () => {
    setLoading(true);
    try {
      const featureRes = await fetch('/api/features/me');
      if (featureRes.ok) {
        const featureData = await featureRes.json();
        if (featureData?.modules?.SERVICE_GPS !== true) {
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

      setTechnicians(techRes.ok ? asArray(await techRes.json()) : []);
      setTickets(ticketsRes.ok ? asArray(await ticketsRes.json()) : []);
      setLiveSnapshot(liveRes.ok ? asArray(await liveRes.json()) : []);
      setLogs(logsRes.ok ? asArray(await logsRes.json()) : []);
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

    const technicianId =
      selectedTechnician && selectedTechnician !== '__NONE__'
        ? selectedTechnician
        : undefined;

    if (!isTechnician && !technicianId) {
      toast.error('Select a technician to check in');
      return;
    }

    setTracking(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const ticketId =
            selectedTicket && selectedTicket !== '__NONE__' ? selectedTicket : undefined;

          const res = await fetch('/api/service/gps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              technicianId,
              ticketId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy ?? undefined,
              speed: position.coords.speed ?? undefined,
              heading: position.coords.heading ?? undefined,
              source: 'PWA',
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || 'Failed to submit location');
          }
          toast.success('Location check-in recorded');
          loadData();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to submit location');
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
    return <div className="space-y-6">Loading GPS tracking...</div>;
  }

  if (!featureEnabled) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
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
              <p className="text-sm mb-2">
                {isTechnician ? 'Technician' : 'Technician (required)'}
              </p>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isTechnician
                        ? 'You (logged-in technician)'
                        : 'Select a technician'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {isTechnician && (
                    <SelectItem value="__NONE__">You (logged-in technician)</SelectItem>
                  )}
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
          <div className="rounded-none border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Captured At</TableHead>
                  <TableHead className="w-12">Map</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveSnapshot.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No recent GPS snapshots.</TableCell></TableRow>
                ) : (
                  liveSnapshot.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.technician?.name || row.technician?.email}</TableCell>
                      <TableCell>{row.latitude.toFixed(6)}</TableCell>
                      <TableCell>{row.longitude.toFixed(6)}</TableCell>
                      <TableCell>{row.accuracy ? `${Math.round(row.accuracy)}m` : '-'}</TableCell>
                      <TableCell>{new Date(row.capturedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <MapLink latitude={row.latitude} longitude={row.longitude} />
                      </TableCell>
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
          <div className="rounded-none border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead className="w-12">Map</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No GPS logs yet.</TableCell></TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.capturedAt).toLocaleString()}</TableCell>
                      <TableCell>{log.technician?.name || log.technician?.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline">{log.source}</Badge></TableCell>
                      <TableCell>{log.ticket?.subject || '-'}</TableCell>
                      <TableCell>
                        <MapLink latitude={log.latitude} longitude={log.longitude} />
                      </TableCell>
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

