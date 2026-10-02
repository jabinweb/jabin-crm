'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readAvDevices, writeAvDevices, type AvDevices } from './av-prefs';

function describe(err: unknown, kind: 'camera' | 'microphone'): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return `Your ${kind} is blocked. Allow access from the icon in your browser's address bar.`;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `No ${kind} found.`;
  if (name === 'NotReadableError') return `Your ${kind} is in use by another app.`;
  return `Couldn't start your ${kind}.`;
}

/**
 * Camera/mic check before joining (ported from Selah components/meeting/use-preview-media).
 * Devices are only opened while toggled on, so the camera light is off when the camera is off.
 * Reports device lists and a live mic level.
 */
export function usePreviewMedia({
  micOn,
  camOn,
  onMicFail,
  onCamFail,
}: {
  micOn: boolean;
  camOn: boolean;
  onMicFail: () => void;
  onCamFail: () => void;
}) {
  const [devices, setDevicesState] = useState<AvDevices>(() => readAvDevices());
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [list, setList] = useState<MediaDeviceInfo[]>([]);
  const [level, setLevel] = useState(0);
  const failRef = useRef({ onMicFail, onCamFail });
  useEffect(() => {
    failRef.current = { onMicFail, onCamFail };
  });

  const refreshList = useCallback(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then(setList)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshList();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshList);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshList);
  }, [refreshList]);

  useEffect(() => {
    if (!camOn) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Your browser cannot use a camera here (HTTPS is required).');
      failRef.current.onCamFail();
      return;
    }
    let cancelled = false;
    let track: MediaStreamTrack | null = null;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          deviceId: devices.videoInput ? { ideal: devices.videoInput } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        track = stream.getVideoTracks()[0] ?? null;
        setVideoTrack(track);
        setCamError(null);
        refreshList();
      })
      .catch((err) => {
        if (cancelled) return;
        setCamError(describe(err, 'camera'));
        failRef.current.onCamFail();
      });
    return () => {
      cancelled = true;
      track?.stop();
      setVideoTrack(null);
    };
  }, [camOn, devices.videoInput, refreshList]);

  useEffect(() => {
    if (!micOn) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Your browser cannot use a microphone here (HTTPS is required).');
      failRef.current.onMicFail();
      return;
    }
    let cancelled = false;
    let track: MediaStreamTrack | null = null;
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: devices.audioInput ? { ideal: devices.audioInput } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        track = stream.getAudioTracks()[0] ?? null;
        setAudioTrack(track);
        setMicError(null);
        refreshList();
      })
      .catch((err) => {
        if (cancelled) return;
        setMicError(describe(err, 'microphone'));
        failRef.current.onMicFail();
      });
    return () => {
      cancelled = true;
      track?.stop();
      setAudioTrack(null);
    };
  }, [micOn, devices.audioInput, refreshList]);

  // Mic level meter
  useEffect(() => {
    if (!audioTrack) return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 80) return;
      last = t;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += ((data[i] - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [audioTrack]);

  const setDevice = useCallback((patch: AvDevices) => {
    writeAvDevices(patch);
    setDevicesState((d) => ({ ...d, ...patch }));
  }, []);

  return {
    videoTrack,
    level: audioTrack ? level : 0,
    camError,
    micError,
    devices,
    setDevice,
    cameras: list.filter((d) => d.kind === 'videoinput' && d.deviceId),
    mics: list.filter((d) => d.kind === 'audioinput' && d.deviceId),
    speakers: list.filter((d) => d.kind === 'audiooutput' && d.deviceId),
  };
}
