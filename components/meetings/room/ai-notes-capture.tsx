'use client';

/**
 * AI notes inside the call:
 * - Organizer/admin: an "AI notes" switch in the top bar.
 * - Everyone: a persistent "AI notes on" pill while capture is on (transparency), plus a
 *   one-time toast when it starts.
 * - Every participant's browser uploads only its OWN published microphone in ~25 s clips
 *   (speaker = the signed-in user → exact labels, nobody transcribed twice). Muted time and
 *   silence are never sent. Audio goes to Gemini and is discarded; only text is stored.
 * State lives on the server (polled + nudged over a LiveKit data message on toggle), so a
 * client can't fake it on or off for others.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { RoomEvent, Track, type Participant } from 'livekit-client';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useMeetingNotesActions, useMeetingNotesStatus } from '@/hooks/use-meeting-notes';
import { downsample, encodeWav, joinBuffers, rms, shouldSendClip, TARGET_SAMPLE_RATE } from '@/lib/meetings/ai-notes/audio';
import { CLIP_SECONDS } from '@/lib/meetings/ai-notes/rules';
import type { MeetingDTO } from '@/lib/meetings/types';
import { cn } from '@/lib/utils';

const NOTES_TOPIC = 'opslane-ai-notes';

export function AiNotesControls({ meeting }: { meeting: MeetingDTO }) {
  const room = useRoomContext();
  const status = useMeetingNotesStatus(meeting.id);
  const actions = useMeetingNotesActions(meeting.id);
  const notes = status.data;
  const on = !!notes?.enabled;
  const canControl = !!notes?.canControl || meeting.canManage;
  // The migration isn't applied (503) or notes are unavailable: no controls at all
  const unavailable = status.isError && !notes;

  // Someone toggled: refetch right away instead of waiting for the next poll
  const refetch = status.refetch;
  useEffect(() => {
    const onData = (_payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic === NOTES_TOPIC) void refetch();
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, refetch]);

  // One-time heads-up when capture starts (and on joining a call where it is already on)
  const announced = useRef(false);
  useEffect(() => {
    if (!on) {
      announced.current = false;
      return;
    }
    if (announced.current) return;
    announced.current = true;
    toast.info('AI notes are on', {
      description: `${notes?.startedBy?.name || 'The organizer'} turned on AI notes. What you say while unmuted is transcribed to write meeting notes. Audio isn't stored.`,
      duration: 8000,
    });
  }, [on, notes?.startedBy?.name]);

  const capture = useOwnMicClips({ meetingId: meeting.id, active: on, onStopped: () => void refetch() });

  const toggle = async () => {
    try {
      await actions.toggle.mutateAsync(!on);
      try {
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ on: !on })), {
          reliable: true,
          topic: NOTES_TOPIC,
        });
      } catch {
        // Others still pick it up on their next poll
      }
      if (on) toast.success('AI notes stopped', { description: 'The summary is written when the meeting ends.' });
    } catch (error) {
      toast.error(on ? 'Could not stop AI notes' : 'Could not start AI notes', {
        description: (error as Error).message,
      });
    }
  };

  if (unavailable) return null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {on ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-100"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                </span>
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI notes on</span>
                <span className="sm:hidden">AI</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              {notes?.startedBy?.name || 'The organizer'} turned on AI notes. Everyone&apos;s microphone (while unmuted) is
              transcribed to write a summary and action items. Audio isn&apos;t stored.
              {capture.error ? <span className="mt-1 block text-amber-500">{capture.error}</span> : null}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {canControl ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={toggle}
          disabled={actions.toggle.isPending || status.isLoading}
          aria-pressed={on}
          className={cn(
            'text-white hover:bg-white/10 hover:text-white',
            on ? 'bg-white/10' : 'border border-white/20'
          )}
        >
          {actions.toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden md:inline">{on ? 'Stop AI notes' : 'AI notes'}</span>
        </Button>
      ) : null}
    </div>
  );
}

type Engine = {
  ctx: AudioContext;
  proc: ScriptProcessorNode;
  sink: GainNode;
  source: MediaStreamAudioSourceNode | null;
  trackId: string | null;
  buffers: Float32Array[];
  clipStartedAt: number | null;
  spoke: boolean;
  wasMuted: boolean;
  timers: Array<ReturnType<typeof setInterval>>;
};

/**
 * While `active`, capture this participant's own published mic track (the one LiveKit sends,
 * with echo cancellation) and upload one clip every CLIP_SECONDS. Uploads run one at a time.
 */
function useOwnMicClips({ meetingId, active, onStopped }: { meetingId: string; active: boolean; onStopped: () => void }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { workspaceFetch } = useWorkspacePaths();
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stoppedRef = useRef(onStopped);
  useEffect(() => {
    stoppedRef.current = onStopped;
  });

  const upload = useCallback(
    (blob: Blob, startedAt: number, durationMs: number) => {
      queue.current = queue.current.then(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const form = new FormData();
          form.set('audio', blob, 'clip.wav');
          form.set('startedAt', String(startedAt));
          form.set('durationMs', String(durationMs));
          try {
            const res = await workspaceFetch(`/api/meetings/${meetingId}/notes/clip`, { method: 'POST', body: form });
            if (res.ok) {
              setError(null);
              return;
            }
            const data = await res.json().catch(() => ({}));
            if (res.status === 409) {
              // Turned off or meeting over: refresh the switch, drop the clip
              stoppedRef.current();
              return;
            }
            if (res.status === 503 && attempt === 0) {
              await new Promise((r) => setTimeout(r, 4000));
              continue;
            }
            setError((data as { error?: string }).error || 'Part of the call could not be transcribed.');
            return;
          } catch {
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            setError('Lost connection while sending notes — the next part will be retried.');
          }
        }
      });
    },
    [meetingId, workspaceFetch]
  );

  useEffect(() => {
    if (!active) return;
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      setError('This browser cannot capture audio for AI notes.');
      return;
    }
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      setError('This browser cannot capture audio for AI notes.');
      return;
    }
    // ScriptProcessor is deprecated but works everywhere without a separate worklet file
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const sink = ctx.createGain();
    sink.gain.value = 0; // keep the processor running without playing anything
    proc.connect(sink);
    sink.connect(ctx.destination);
    const engine: Engine = {
      ctx,
      proc,
      sink,
      source: null,
      trackId: null,
      buffers: [],
      clipStartedAt: null,
      spoke: false,
      wasMuted: false,
      timers: [],
    };

    const micTrack = () => {
      const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
      const track = pub?.track?.mediaStreamTrack;
      const muted = !pub || pub.isMuted || !track || track.readyState !== 'live' || !track.enabled;
      return { track, muted };
    };

    const flush = () => {
      const chunks = engine.buffers;
      const startedAt = engine.clipStartedAt;
      const spoke = engine.spoke;
      engine.buffers = [];
      engine.clipStartedAt = null;
      engine.spoke = false;
      if (!chunks.length || startedAt === null) return;
      const pcm = downsample(joinBuffers(chunks), ctx.sampleRate, TARGET_SAMPLE_RATE);
      if (pcm.length < TARGET_SAMPLE_RATE) return; // under a second
      if (!shouldSendClip(rms(pcm), spoke)) return;
      upload(encodeWav(pcm, TARGET_SAMPLE_RATE), startedAt, Math.round((pcm.length / TARGET_SAMPLE_RATE) * 1000));
    };

    // Follow the published mic (device switches replace the track)
    const attach = () => {
      const { track } = micTrack();
      if (!track || track.id === engine.trackId) return;
      try {
        engine.source?.disconnect();
        engine.source = ctx.createMediaStreamSource(new MediaStream([track]));
        engine.source.connect(proc);
        engine.trackId = track.id;
      } catch {
        engine.trackId = null;
      }
    };

    proc.onaudioprocess = (ev) => {
      const { muted } = micTrack();
      if (muted) {
        // Muting closes the current clip so muted time is never sent
        if (!engine.wasMuted) flush();
        engine.wasMuted = true;
        return;
      }
      engine.wasMuted = false;
      const data = new Float32Array(ev.inputBuffer.getChannelData(0));
      if (engine.clipStartedAt === null) {
        engine.clipStartedAt = Date.now() - Math.round((data.length / ctx.sampleRate) * 1000);
      }
      engine.buffers.push(data);
      if (localParticipant.isSpeaking) engine.spoke = true;
    };

    const onSpeakers = (speakers: Participant[]) => {
      if (speakers.some((p) => p.identity === localParticipant.identity)) engine.spoke = true;
    };
    room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);

    // Autoplay rules: the join click usually unlocks audio; otherwise resume on the next tap
    const resume = () => void ctx.resume().catch(() => {});
    resume();
    document.addEventListener('pointerdown', resume);

    attach();
    engine.timers.push(setInterval(attach, 2000));
    engine.timers.push(setInterval(flush, CLIP_SECONDS * 1000));

    return () => {
      engine.timers.forEach(clearInterval);
      room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
      document.removeEventListener('pointerdown', resume);
      flush(); // send the last words (turned off, left, or meeting ended)
      proc.onaudioprocess = null;
      try {
        engine.source?.disconnect();
        proc.disconnect();
        sink.disconnect();
      } catch {
        /* already disconnected */
      }
      void ctx.close().catch(() => {});
    };
  }, [active, localParticipant, room, upload]);

  return { error };
}
