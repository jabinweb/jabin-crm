'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar, AvatarStack } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import type { MeetingDTO } from '@/lib/meetings/types';
import { readDefaultAvPrefs, writeAvPrefs } from './av-prefs';
import { usePreviewMedia } from './use-preview-media';

/**
 * Camera & mic check before entering the room (layout adapted from Selah's MeetingPreJoin).
 * Shows who is already inside so people know the meeting has started.
 */
export function MeetingPreJoin({
  meeting,
  me,
  joining,
  onJoin,
  onCancel,
}: {
  meeting: MeetingDTO;
  me: { id: string; name?: string | null; email?: string | null; image?: string | null };
  joining?: boolean;
  onJoin: (prefs: { audio: boolean; video: boolean }) => void;
  onCancel: () => void;
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  // localStorage is only readable after hydration
  useEffect(() => {
    const prefs = readDefaultAvPrefs();
    setMicOn(prefs.audio);
    setCamOn(prefs.video);
  }, []);

  const media = usePreviewMedia({
    micOn,
    camOn,
    onMicFail: () => setMicOn(false),
    onCamFail: () => setCamOn(false),
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = media.videoTrack ? new MediaStream([media.videoTrack]) : null;
  }, [media.videoTrack]);

  const inRoom = meeting.attendees.filter((a) => a.inRoom && a.user.id !== me.id);

  const join = () => {
    writeAvPrefs(meeting.id, { audio: micOn, video: camOn });
    onJoin({ audio: micOn, video: camOn });
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
      <div className="space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
          {camOn && media.videoTrack ? (
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-400">
              <UserAvatar person={me} size="xl" />
              <p className="text-sm">{camOn ? 'Starting camera…' : 'Camera is off'}</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-3">
            <button
              type="button"
              onClick={() => setMicOn((v) => !v)}
              aria-pressed={micOn}
              aria-label={micOn ? 'Turn microphone off' : 'Turn microphone on'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                micOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-red-600 text-white hover:bg-red-500'
              )}
            >
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setCamOn((v) => !v)}
              aria-pressed={camOn}
              aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                camOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-red-600 text-white hover:bg-red-500'
              )}
            >
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </div>
          {micOn ? (
            <div className="absolute left-3 top-3 flex h-6 items-end gap-0.5 rounded-full bg-black/40 px-2 py-1" aria-hidden>
              {[0.15, 0.35, 0.55, 0.75].map((t) => (
                <span
                  key={t}
                  className={cn('w-1 rounded-full transition-all', media.level > t ? 'bg-emerald-400' : 'bg-white/30')}
                  style={{ height: `${6 + t * 12}px` }}
                />
              ))}
            </div>
          ) : null}
        </div>
        {media.camError || media.micError ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">{media.camError || media.micError}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <DeviceSelect
            label="Microphone"
            devices={media.mics}
            value={media.devices.audioInput}
            onChange={(id) => media.setDevice({ audioInput: id })}
          />
          <DeviceSelect
            label="Camera"
            devices={media.cameras}
            value={media.devices.videoInput}
            onChange={(id) => media.setDevice({ videoInput: id })}
          />
          <DeviceSelect
            label="Speaker"
            devices={media.speakers}
            value={media.devices.audioOutput}
            onChange={(id) => media.setDevice({ audioOutput: id })}
          />
        </div>
      </div>

      <div className="space-y-4 text-center lg:text-left">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Ready to join?</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{meeting.title}</p>
        </div>
        {inRoom.length > 0 ? (
          <div className="flex items-center justify-center gap-2 lg:justify-start">
            <AvatarStack people={inRoom.map((a) => a.user)} max={4} size="sm" />
            <p className="text-sm text-muted-foreground">
              {inRoom.length === 1
                ? `${inRoom[0].user.name || 'A teammate'} is here`
                : `${inRoom[0].user.name || 'A teammate'} and ${inRoom.length - 1} other${inRoom.length > 2 ? 's' : ''} are here`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No one else is here yet.</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <Button size="lg" className="w-full" onClick={join} disabled={joining}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            Join now
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={onCancel}>
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeviceSelect({
  label,
  devices,
  value,
  onChange,
}: {
  label: string;
  devices: MediaDeviceInfo[];
  value?: string;
  onChange: (id: string) => void;
}) {
  if (devices.length === 0) return null;
  const current = value && devices.some((d) => d.deviceId === value) ? value : devices[0].deviceId;
  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {devices.map((d, i) => (
          <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
            {d.label || `${label} ${i + 1}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
