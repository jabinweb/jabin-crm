'use client';

/**
 * The in-call view: LiveKit room with grid / speaker focus, screen share, chat and device
 * controls (LiveKit's VideoConference prefab), plus an Opslane top bar with the meeting title,
 * elapsed time, participant count and "End for everyone" for the organizer.
 * Connection handling (token fetch, drop/rejoin, duplicate tab) is ported from Selah's
 * components/livekit-video-room.tsx. Loaded with next/dynamic so LiveKit stays out of other pages.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { DisconnectReason, RoomEvent, Track, VideoPresets, type RoomOptions } from 'livekit-client';
import '@livekit/components-styles';
import { Loader2, PhoneOff, Users, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { MeetingDTO } from '@/lib/meetings/types';
import { readAvDevices, readAvPrefs, writeAvPrefs } from './av-prefs';
import { AiNotesControls } from './ai-notes-capture';

export type LeaveReason = 'left' | 'ended' | 'removed';

type Connection = { token: string; url: string; isHost: boolean };

export default function MeetingRoom({
  meeting,
  initialAudio,
  initialVideo,
  onLeave,
  onEndForAll,
}: {
  meeting: MeetingDTO;
  initialAudio: boolean;
  initialVideo: boolean;
  onLeave: (reason: LeaveReason) => void;
  onEndForAll: () => Promise<void>;
}) {
  const { workspaceFetch } = useWorkspacePaths();
  const [conn, setConn] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const leavingRef = useRef(false);
  const [avPrefs] = useState(() => readAvPrefs(meeting.id, { audio: initialAudio, video: initialVideo }));
  const [devices] = useState(() => readAvDevices());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConn(null);
      setError(null);
      try {
        const res = await workspaceFetch(`/api/meetings/${meeting.id}/token`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token || !data.url) throw new Error(data.error || 'Could not join the room');
        if (!cancelled) setConn({ token: data.token, url: data.url, isHost: !!data.isHost });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not join the room');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meeting.id, attempt, workspaceFetch]);

  const handleLeave = useCallback(
    (reason: LeaveReason) => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      onLeave(reason);
    },
    [onLeave]
  );

  const roomOptions = useMemo<RoomOptions>(
    () => ({
      // Pause video nobody sees and only send simulcast layers someone watches
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        deviceId: devices.videoInput,
        resolution: VideoPresets.h720.resolution,
      },
      audioCaptureDefaults: {
        deviceId: devices.audioInput,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      audioOutput: devices.audioOutput ? { deviceId: devices.audioOutput } : undefined,
      publishDefaults: { simulcast: true },
    }),
    [devices]
  );

  if (error) {
    return (
      <Shell>
        <p className="max-w-md text-sm text-white/80">{error}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => handleLeave('left')}>
            Go back
          </Button>
        </div>
      </Shell>
    );
  }

  if (dropped) {
    return (
      <Shell>
        <WifiOff className="h-8 w-8 text-zinc-400" />
        <p className="max-w-md text-sm text-white/80">{dropped}</p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setDropped(null);
              setAttempt((n) => n + 1);
            }}
          >
            Rejoin
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => handleLeave('left')}>
            Leave
          </Button>
        </div>
      </Shell>
    );
  }

  if (!conn) {
    return (
      <Shell>
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        <p className="text-sm text-white/70">Joining {meeting.title}…</p>
      </Shell>
    );
  }

  return (
    <LiveKitRoom
      key={attempt}
      token={conn.token}
      serverUrl={conn.url}
      connect
      options={roomOptions}
      video={avPrefs.video}
      audio={avPrefs.audio}
      data-lk-theme="default"
      className="flex h-full w-full flex-col"
      onDisconnected={(reason) => {
        if (leavingRef.current) return;
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) handleLeave('removed');
        else if (reason === DisconnectReason.ROOM_DELETED) handleLeave('ended');
        else if (reason === DisconnectReason.CLIENT_INITIATED) handleLeave('left');
        else if (reason === DisconnectReason.DUPLICATE_IDENTITY)
          setDropped('You joined this meeting from another tab or device.');
        else setDropped('You lost connection to the meeting.');
      }}
      onError={(err) => console.error('LiveKit room error:', err)}
    >
      <RoomTopBar meeting={meeting} isHost={conn.isHost} onEndForAll={onEndForAll} />
      <div className="min-h-0 flex-1">
        <VideoConference />
      </div>
      <RoomAudioRenderer />
      <PersistAvPrefs roomId={meeting.id} />
    </LiveKitRoom>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-white">
      {children}
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return <span className="tabular-nums">{h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`}</span>;
}

function RoomTopBar({
  meeting,
  isHost,
  onEndForAll,
}: {
  meeting: MeetingDTO;
  isHost: boolean;
  onEndForAll: () => Promise<void>;
}) {
  const participants = useParticipants();
  const [joinedAt] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-zinc-950 px-3 py-2 text-white sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{meeting.title}</p>
        <p className="flex items-center gap-2 text-xs text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <Elapsed since={joinedAt} />
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {participants.length}
          </span>
        </p>
      </div>
      <AiNotesControls meeting={meeting} />
      {isHost ? (
        <>
          <Button
            size="sm"
            variant="destructive"
            className="shrink-0"
            onClick={() => setConfirm(true)}
            disabled={ending}
          >
            {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
            <span className="hidden sm:inline">End for everyone</span>
            <span className="sm:hidden">End</span>
          </Button>
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End the meeting for everyone?</AlertDialogTitle>
                <AlertDialogDescription>
                  Everyone in the room is disconnected and the meeting is marked as done.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep meeting</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    setEnding(true);
                    try {
                      await onEndForAll();
                    } finally {
                      setEnding(false);
                    }
                  }}
                >
                  End meeting
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}

/**
 * Remember mic/cam mute state so a rejoin (or reload) restores it
 * (ported from Selah components/meeting/persist-livekit-av-prefs).
 */
function PersistAvPrefs({ roomId }: { roomId: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  useEffect(() => {
    const sync = () => {
      const mic = localParticipant.getTrackPublication(Track.Source.Microphone);
      const cam = localParticipant.getTrackPublication(Track.Source.Camera);
      if (!mic && !cam) return;
      const prev = readAvPrefs(roomId);
      writeAvPrefs(roomId, {
        audio: mic ? !mic.isMuted : prev.audio,
        video: cam ? !cam.isMuted : prev.video,
      });
    };
    sync();
    room.on(RoomEvent.LocalTrackPublished, sync);
    room.on(RoomEvent.LocalTrackUnpublished, sync);
    room.on(RoomEvent.TrackMuted, sync);
    room.on(RoomEvent.TrackUnmuted, sync);
    return () => {
      sync();
      room.off(RoomEvent.LocalTrackPublished, sync);
      room.off(RoomEvent.LocalTrackUnpublished, sync);
      room.off(RoomEvent.TrackMuted, sync);
      room.off(RoomEvent.TrackUnmuted, sync);
    };
  }, [room, localParticipant, roomId]);
  return null;
}
