'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { CardListSkeleton } from '@/components/loading';
import { humanizeEnum, ENUM_LABEL_OVERRIDES } from '@/lib/humanize-enum';

const SOURCE_LABELS: Record<string, string> = { PWA: 'Browser', MOBILE: 'Mobile app', MANUAL: 'Manual' };

function formatTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy, HH:mm');
}
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
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
    // Initial state is loading; refreshes after a save keep the page visible.
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
      toast.error("This browser can't share location. Try a different browser or device.");
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
        toast.error("Couldn't get your location. Allow location access for this site and try again.");
        setTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const header = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">GPS tracking</h1>
      <p className="text-sm text-muted-foreground">Track field movement and capture technician check-ins.</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <CardListSkeleton rows={4} />
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardHeader><CardTitle>GPS tracking isn&apos;t enabled</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This module is turned off for your workspace. Ask your administrator to enable it.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardHeader>
          <CardTitle>Technician check-in</CardTitle>
          <CardDescription>Saves this device's current location for the selected technician. Your browser will ask for location permission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="gps-tech" className="mb-2 block">
                Technician
              </Label>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger id="gps-tech">
                  <SelectValue
                    placeholder={
                      isTechnician
                        ? 'You'
                        : 'Select a technician'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {isTechnician && (
                    <SelectItem value="__NONE__">You</SelectItem>
                  )}
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name || tech.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="gps-ticket" className="mb-2 block">Ticket (optional)</Label>
              <Select value={selectedTicket} onValueChange={setSelectedTicket}>
                <SelectTrigger id="gps-ticket"><SelectValue placeholder="Select ticket" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">No ticket</SelectItem>
                  {tickets.map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>{ticket.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full sm:w-auto" onClick={checkInNow} disabled={tracking}>
            {tracking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
            {tracking ? 'Capturing location…' : 'Check in at current location'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Latest positions</CardTitle><CardDescription>Most recent check-in for each technician.</CardDescription></CardHeader>
        <CardContent>
          <div className="rounded-none border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead className="w-12">Map</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveSnapshot.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No check-ins yet. Use “Check in at current location” above to record one.</TableCell></TableRow>
                ) : (
                  liveSnapshot.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.technician?.name || row.technician?.email}</TableCell>
                      <TableCell>{row.latitude.toFixed(6)}</TableCell>
                      <TableCell>{row.longitude.toFixed(6)}</TableCell>
                      <TableCell>{row.accuracy ? `±${Math.round(row.accuracy)} m` : '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatTime(row.capturedAt)}</TableCell>
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
        <CardHeader><CardTitle>Location history</CardTitle></CardHeader>
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
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No location history yet.</TableCell></TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{formatTime(log.capturedAt)}</TableCell>
                      <TableCell>{log.technician?.name || log.technician?.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline">{SOURCE_LABELS[log.source] ?? humanizeEnum(log.source, ENUM_LABEL_OVERRIDES)}</Badge></TableCell>
                      <TableCell>{log.ticket?.subject || '—'}</TableCell>
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

