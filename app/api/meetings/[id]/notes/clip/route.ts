import { NextResponse } from 'next/server';
import { appendClip } from '@/lib/meetings/ai-notes/service';
import { withNotesRoute } from '@/lib/meetings/ai-notes/route';
import { MAX_CLIP_BYTES } from '@/lib/meetings/ai-notes/rules';
import { meetingViewer } from '@/lib/meetings/route';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/meetings/:id/notes/clip (multipart: audio, startedAt, durationMs)
 * One ~25 s clip of the caller's OWN microphone while AI notes are on. The speaker is the
 * signed-in user, so labels are exact and nobody is transcribed twice. Audio goes to Gemini
 * and is discarded — only the text is stored.
 */
export const POST = withNotesRoute(async (request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_CLIP_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Clip too large' }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get('audio');
  if (!form || !(audio instanceof Blob)) {
    return NextResponse.json({ error: 'Missing audio' }, { status: 400 });
  }
  if (audio.size > MAX_CLIP_BYTES) {
    return NextResponse.json({ error: 'Clip too large' }, { status: 413 });
  }
  const result = await appendClip(id, companyId, meetingViewer(session), {
    audio: new Uint8Array(await audio.arrayBuffer()),
    mediaType: (audio.type || 'audio/wav').split(';')[0].trim().toLowerCase(),
    startedAt: form.get('startedAt'),
    durationMs: form.get('durationMs'),
  });
  return NextResponse.json(result);
});
