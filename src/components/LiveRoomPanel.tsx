import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Mic,
  MicOff,
  PhoneCall,
  Radio,
  Send,
  Square,
  Volume2,
  Zap,
} from 'lucide-react';
import type { AccessibilityMode, LiveRoomEntry } from '../types/lumi';
import {
  MODE_METADATA,
  buildMuteQuickReplies,
  extractRoomCodeFromSpeech,
  isHangupVoiceCommand,
  normalizeVoice,
} from '../utils/lumiLogic';
import {
  isSpeechRecognitionSupported,
  speakWithBestVoice,
  startSingleSpeechCapture,
  stopAllSpeech,
} from '../utils/speech';
import { LumiOrb } from './LumiOrb';

interface LiveRoomPanelProps {
  mode: AccessibilityMode;
  userName?: string;
  roomCode: string;
  onRoomCodeChange: (code: string) => void;
  onLeaveRoom: () => void;
  registerRoomVoiceHandler?: (handler: ((transcript: string) => string | null) | null) => void;
  autoStartAudioRecord?: boolean;
  onAutoStartConsumed?: () => void;
}

const ROOM_STORAGE_PREFIX = 'lumi_live_room_v1_';

function audioBufferToWavBlob(buffer: AudioBuffer, maxSamples: number): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = Math.max(1, Math.min(buffer.length, maxSamples));
  const dataSize = length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function trimLastSecondFromAudioBlob(blob: Blob, trimSec = 1.0): Promise<Blob> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return blob;
    const ctx = new AudioCtx();
    const arrayBuf = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    await ctx.close().catch(() => {});
    if (decoded.duration <= trimSec + 0.4) {
      return blob;
    }
    const targetDuration = Math.max(0.4, decoded.duration - trimSec);
    const maxSamples = Math.floor(targetDuration * decoded.sampleRate);
    return audioBufferToWavBlob(decoded, maxSamples);
  } catch {
    return blob;
  }
}

function playPriorityChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Ignorar si el navegador bloquea AudioContext sin interacción
  }
}

export const LiveRoomPanel: React.FC<LiveRoomPanelProps> = ({
  mode,
  userName = 'Tú',
  roomCode,
  onRoomCodeChange,
  onLeaveRoom,
  registerRoomVoiceHandler,
  autoStartAudioRecord,
  onAutoStartConsumed,
}) => {
  const [entries, setEntries] = useState<LiveRoomEntry[]>([]);
  const [liveCaption, setLiveCaption] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<{
    dataUrl: string;
    durationSec: number;
  } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [writtenReply, setWrittenReply] = useState('');
  const [micError, setMicError] = useState('');
  const [flashActive, setFlashActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverSynced, setServerSynced] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const stopCaptureRef = useRef<(() => void) | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const storageKey = `${ROOM_STORAGE_PREFIX}${roomCode.toUpperCase()}`;

  // Cargar historial local y sincronizar entre pestañas (BroadcastChannel) + servidor si está activo
  useEffect(() => {
    const cleanCode = roomCode.trim().toUpperCase() || 'LUMI-942';
    try {
      const raw = localStorage.getItem(`${ROOM_STORAGE_PREFIX}${cleanCode}`);
      if (raw) {
        setEntries(JSON.parse(raw) as LiveRoomEntry[]);
      } else {
        const welcome: LiveRoomEntry = {
          id: `room-welcome-${cleanCode}`,
          roomCode: cleanCode,
          senderName: 'Lumi Sala',
          senderMode: 'general',
          kind: 'text',
          text: `Sala ${cleanCode} lista. Graba audio, activa subtítulos en vivo para sordo o responde con texto y voz.`,
          createdAt: new Date().toISOString(),
        };
        setEntries([welcome]);
        localStorage.setItem(`${ROOM_STORAGE_PREFIX}${cleanCode}`, JSON.stringify([welcome]));
      }
    } catch {
      setEntries([]);
    }

    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(`lumi-room-${cleanCode}`);
      channelRef.current = bc;
      bc.onmessage = (event) => {
        const incoming = event.data as LiveRoomEntry;
        if (!incoming?.id) return;
        setEntries((prev) => (prev.some((e) => e.id === incoming.id) ? prev : [...prev, incoming]));
        if (incoming.kind === 'alert') {
          if (incoming.alertType === 'luz') {
            setFlashActive(true);
            window.setTimeout(() => setFlashActive(false), 4000);
          } else if (incoming.alertType === 'sonido') {
            playPriorityChime();
          } else if (incoming.alertType === 'vibracion' && 'vibrate' in navigator) {
            navigator.vibrate([220, 100, 220]);
          }
        }
      };
      return () => {
        bc.close();
        channelRef.current = null;
      };
    }
  }, [roomCode]);

  // Sondeo ligero al servidor Express si está disponible (Celu <-> PC en la misma red)
  useEffect(() => {
    const cleanCode = roomCode.trim().toUpperCase() || 'LUMI-942';
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(cleanCode)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { entries?: LiveRoomEntry[] };
        if (cancelled || !Array.isArray(data.entries)) return;
        setServerSynced(true);
        if (data.entries.length > 0) {
          setEntries((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const merged = [...prev];
            for (const item of data.entries!) {
              if (!ids.has(item.id)) merged.push(item);
            }
            return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          });
        }
      } catch {
        if (!cancelled) setServerSynced(false);
      }
    };
    poll();
    const id = window.setInterval(poll, 3500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomCode]);

  const pushEntry = async (entry: LiveRoomEntry) => {
    setEntries((prev) => {
      const next = [...prev, entry];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next.slice(-50)));
      } catch {
        // ignore quota
      }
      return next;
    });
    channelRef.current?.postMessage(entry);
    try {
      await fetch(`/api/rooms/${encodeURIComponent(entry.roomCode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      // Modo local / PWA sin servidor: funciona igual en el dispositivo
    }
  };

  // Último texto hablado o transcrito para mostrar subtítulo grande (sordo) y sugerencias (mudo)
  const lastSpokenOrText = useMemo(() => {
    const reversed = [...entries].reverse();
    const found = reversed.find(
      (e) => e.kind === 'transcript' || e.kind === 'text' || e.kind === 'quick_reply'
    );
    return liveCaption || found?.text || '';
  }, [entries, liveCaption]);

  const muteQuickReplies = useMemo(
    () => buildMuteQuickReplies(lastSpokenOrText),
    [lastSpokenOrText]
  );

  const handleStartAudioRecording = async () => {
    stopAllSpeech();
    setMicError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError(
        'Tu navegador no permite grabar audio directamente. Usa Chrome o Edge actualizado sobre HTTPS o localhost.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const trimmedBlob = await trimLastSecondFromAudioBlob(rawBlob, 1.0);
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
          if (dataUrl) {
            setPendingAudio({
              dataUrl,
              durationSec: Math.max(1, recordingSeconds - 1),
            });
          }
        };
        reader.readAsDataURL(trimmedBlob);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setMicError(
        'Permiso de micrófono denegado o bloqueado. Activa el micrófono en la configuración de tu navegador para grabar audio.'
      );
    }
  };

  const handleStopAudioRecording = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  };

  const handleSendPendingAudio = () => {
    if (!pendingAudio) return;
    const cleanCode = roomCode.trim().toUpperCase() || 'LUMI-942';
    pushEntry({
      id: `audio-${Date.now()}`,
      roomCode: cleanCode,
      senderName: userName || 'Tú',
      senderMode: mode,
      kind: 'audio',
      text: `Audio grabado (${pendingAudio.durationSec}s)`,
      audioDataUrl: pendingAudio.dataUrl,
      audioDurationSec: pendingAudio.durationSec,
      createdAt: new Date().toISOString(),
    });
    setPendingAudio(null);
  };

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('lumi:recording-state', { detail: { recording: isRecordingAudio } })
    );
    return () => {
      if (isRecordingAudio) {
        window.dispatchEvent(
          new CustomEvent('lumi:recording-state', { detail: { recording: false } })
        );
      }
    };
  }, [isRecordingAudio]);

  useEffect(() => {
    if (autoStartAudioRecord && !isRecordingAudio) {
      onAutoStartConsumed?.();
      handleStartAudioRecording();
    }
  }, [autoStartAudioRecord]);

  useEffect(() => {
    if (!registerRoomVoiceHandler) return;
    registerRoomVoiceHandler((transcript: string) => {
      const norm = normalizeVoice(transcript);

      if (
        isRecordingAudio &&
        (norm === 'para' ||
          norm === 'parar' ||
          norm.includes('detener') ||
          norm.includes('para de grabar') ||
          norm.includes('deja de grabar'))
      ) {
        handleStopAudioRecording();
        return 'Grabación detenida. Di "Enviar" o presiona "Enviar audio" para mandarlo.';
      }

      if (
        !isRecordingAudio &&
        (norm.includes('graba un audio') ||
          norm.includes('grabar audio') ||
          norm === 'grabar' ||
          norm === 'graba')
      ) {
        handleStartAudioRecording();
        return '[SILENT] Grabando audio en silencio. Toca cualquier parte de la pantalla o di "Para" para detener.';
      }

      if (
        pendingAudio &&
        (norm === 'enviar' ||
          norm === 'mandar' ||
          norm.includes('enviar audio') ||
          norm.includes('mandar audio') ||
          norm.includes('enviar mensaje'))
      ) {
        handleSendPendingAudio();
        return 'Audio enviado a la sala.';
      }

      if (pendingAudio && (norm.includes('descartar') || norm.includes('cancelar audio'))) {
        setPendingAudio(null);
        return 'Audio descartado.';
      }

      return null;
    });

    return () => registerRoomVoiceHandler(null);
  }, [registerRoomVoiceHandler, isRecordingAudio, pendingAudio, roomCode]);

  const handleHangupCall = () => {
    if (isRecordingAudio) handleStopAudioRecording();
    if (isTranscribing) {
      stopCaptureRef.current?.();
      stopCaptureRef.current = null;
      setIsTranscribing(false);
    }
    const cleanCode = roomCode.trim().toUpperCase() || 'LUMI-942';
    pushEntry({
      id: `hangup-${Date.now()}`,
      roomCode: cleanCode,
      senderName: userName || 'Tú',
      senderMode: mode,
      kind: 'text',
      text: 'Llamada finalizada (colgar).',
      createdAt: new Date().toISOString(),
    });
    if (mode !== 'sordo') {
      speakWithBestVoice('Llamada finalizada.');
    }
    onLeaveRoom();
  };

  const handleToggleLiveCaptions = () => {
    setMicError('');
    if (isTranscribing) {
      stopCaptureRef.current?.();
      stopCaptureRef.current = null;
      setIsTranscribing(false);
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setMicError(
        'Los subtítulos por micrófono requieren Chrome o Edge. Puedes usar el campo escrito mientras tanto.'
      );
      return;
    }
    setIsTranscribing(true);
    const stop = startSingleSpeechCapture({
      onResult: (transcript) => {
        if (isHangupVoiceCommand(transcript) || normalizeVoice(transcript) === 'salir') {
          handleHangupCall();
          return;
        }
        const nextRoom = extractRoomCodeFromSpeech(transcript);
        if (nextRoom) {
          onRoomCodeChange(nextRoom);
          setLiveCaption(`Cambiando a sala ${nextRoom}`);
          return;
        }
        setLiveCaption(transcript);
        const cleanCode = roomCode.trim().toUpperCase() || 'LUMI-942';
        pushEntry({
          id: `tr-${Date.now()}`,
          roomCode: cleanCode,
          senderName: userName || 'Voz en sala',
          senderMode: mode,
          kind: 'transcript',
          text: transcript,
          createdAt: new Date().toISOString(),
        });
      },
      onError: (msg) => {
        setMicError(msg);
        setIsTranscribing(false);
      },
      onEnd: () => {
        setIsTranscribing(false);
      },
    });
    stopCaptureRef.current = stop;
  };

  const handleSendWritten = (text: string, speakAloud: boolean, isQuick = false) => {
    const clean = text.trim();
    if (!clean) return;
    const cleanCode = roomCode.trim().toUpperCase() || 'LUMI-942';
    pushEntry({
      id: `txt-${Date.now()}`,
      roomCode: cleanCode,
      senderName: userName || 'Tú',
      senderMode: mode,
      kind: isQuick ? 'quick_reply' : 'text',
      text: clean,
      createdAt: new Date().toISOString(),
    });
    if (speakAloud) {
      speakWithBestVoice(clean);
    }
    if (!isQuick) setWrittenReply('');
  };

  const handleTriggerAlert = (alertType: 'luz' | 'sonido' | 'vibracion') => {
    const cleanCode = roomCode.trim().toUpperCase() || 'LUMI-942';
    if (alertType === 'luz') {
      setFlashActive(true);
      window.setTimeout(() => setFlashActive(false), 4000);
    } else if (alertType === 'sonido') {
      playPriorityChime();
    } else if (alertType === 'vibracion' && 'vibrate' in navigator) {
      navigator.vibrate([220, 100, 220]);
    }
    pushEntry({
      id: `alert-${Date.now()}`,
      roomCode: cleanCode,
      senderName: userName || 'Tú',
      senderMode: mode,
      kind: 'alert',
      alertType,
      text:
        alertType === 'luz'
          ? 'Alerta luminosa enviada a la sala'
          : alertType === 'sonido'
            ? 'Alerta sonora prioritaria enviada'
            : 'Vibración háptica activada',
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <>
      {isRecordingAudio && (
        <button
          type="button"
          onClick={handleStopAudioRecording}
          aria-label="Detener grabación de audio. Toca cualquier parte de la pantalla para parar."
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#DC2626] p-8 text-center text-white focus-visible:outline-white"
        >
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/50">
            <Square className="h-12 w-12 fill-white text-white" aria-hidden="true" />
          </span>
          <span className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            PARAR GRABACIÓN
          </span>
          <span className="tabular-nums rounded-full bg-black/30 px-6 py-2 text-2xl font-bold">
            {recordingSeconds}s
          </span>
          <span className="max-w-md text-base font-semibold text-white/95 sm:text-lg">
            Toca cualquier parte de la pantalla o di &ldquo;PARA&rdquo; para detener. El audio no se enviará hasta que digas &ldquo;Enviar&rdquo;.
          </span>
        </button>
      )}

      <div
        className={`space-y-5 rounded-2xl border border-[#E9E5D9] bg-white p-5 ${
          flashActive ? 'lumi-flash-banner ring-4 ring-[#F5DF91]' : ''
        }`}
      >
      {/* Cabecera de Sala en Vivo */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F2EFE6] pb-4">
        <div className="flex items-center gap-3">
          <LumiOrb size="sm" active={isRecordingAudio || isTranscribing} />
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#202020]">
              <PhoneCall className="h-5 w-5 text-[#7D6618]" aria-hidden="true" />
              Sala en vivo y Llamada accesible (Celu ↔ PC)
            </h2>
            <p className="text-xs text-[#555555]">
              {serverSynced
                ? 'Sincronizado en tiempo real con el servidor Lumi.'
                : 'Modo local activo (sincroniza pestañas en este dispositivo; inicia el servidor para Celu ↔ PC en red).'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="room-code-input" className="sr-only">
            Código de sala
          </label>
          <input
            id="room-code-input"
            type="text"
            value={roomCode}
            onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
            className="w-28 rounded-xl border border-[#E9E5D9] bg-[#FFF9E9] px-3 py-2 text-center font-mono text-sm font-bold uppercase text-[#202020]"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(roomCode);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-3 text-xs font-bold hover:bg-[#F7F5EE]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={handleHangupCall}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#DC2626] px-3.5 text-xs font-bold text-white hover:bg-[#B91C1C]"
          >
            Colgar
          </button>
        </div>
      </div>

      {/* Subtítulo gigante en vivo para Modo Sordo */}
      <div
        aria-live="polite"
        className="rounded-2xl border-2 border-[#202020] bg-[#171717] p-4 text-white"
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#F5DF91]">
          Pantalla de subtítulos en vivo (Modo Sordo / Llamada)
        </p>
        <p className="mt-1.5 text-lg font-bold leading-snug sm:text-xl">
          {lastSpokenOrText || 'Pulsa "Subtítulos en vivo" para pasar palabras habladas a texto en pantalla.'}
        </p>
      </div>

      {/* Controles de audio y subtítulos */}
      <div className="flex flex-wrap gap-3">
        {!isRecordingAudio ? (
          <button
            type="button"
            onClick={handleStartAudioRecording}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#F5DF91] px-4 py-2 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            Grabar audio en sala
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopAudioRecording}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-bold text-white hover:bg-[#B91C1C]"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
            Detener grabación ({recordingSeconds}s)
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleLiveCaptions}
          className={`inline-flex min-h-[46px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold ${
            isTranscribing
              ? 'border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]'
              : 'border-[#E9E5D9] bg-[#FFF9E9] text-[#202020] hover:bg-[#F5DF91]'
          }`}
        >
          {isTranscribing ? (
            <>
              <MicOff className="h-4 w-4" aria-hidden="true" />
              Detener subtítulos
            </>
          ) : (
            <>
              <Radio className="h-4 w-4" aria-hidden="true" />
              Subtítulos en vivo (Voz → Texto)
            </>
          )}
        </button>

        {/* Alertas sensoriales */}
        <button
          type="button"
          onClick={() => handleTriggerAlert('luz')}
          className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-3 text-xs font-bold hover:bg-[#FFF9E9]"
        >
          <Zap className="h-4 w-4 text-[#D9BF68]" aria-hidden="true" />
          Luz
        </button>
        <button
          type="button"
          onClick={() => handleTriggerAlert('sonido')}
          className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-3 text-xs font-bold hover:bg-[#FFF9E9]"
        >
          <Volume2 className="h-4 w-4 text-[#7D6618]" aria-hidden="true" />
          Sonido
        </button>
        <button
          type="button"
          onClick={() => handleTriggerAlert('vibracion')}
          className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-3 text-xs font-bold hover:bg-[#FFF9E9]"
        >
          Vibrar
        </button>
      </div>

      {micError && (
        <p role="alert" className="rounded-xl bg-[#FEE2E2] px-4 py-2.5 text-xs font-semibold text-[#991B1B]">
          {micError}
        </p>
      )}

      {pendingAudio && (
        <div
          role="region"
          aria-label="Audio listo para enviar"
          className="space-y-3 rounded-2xl border-2 border-[#D9BF68] bg-[#FFF9E9] p-4"
        >
          <p className="text-sm font-bold text-[#202020]">
            Audio grabado ({pendingAudio.durationSec}s) — listo para enviar
          </p>
          <audio controls src={pendingAudio.dataUrl} className="h-10 w-full max-w-md" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSendPendingAudio}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#F5DF91] px-5 py-2 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Enviar audio
            </button>
            <button
              type="button"
              onClick={() => setPendingAudio(null)}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-4 py-2 text-sm font-semibold text-[#555555] hover:bg-[#F7F5EE]"
            >
              Descartar
            </button>
          </div>
          <p className="text-xs text-[#555555]">
            También puedes decir <strong>&ldquo;Enviar&rdquo;</strong> o <strong>&ldquo;Mandar&rdquo;</strong> por voz.
          </p>
        </div>
      )}

      {/* Panel para Modo Mudo: posibles respuestas sugeridas + escritura libre */}
      <div className="space-y-3 rounded-2xl border border-[#D9BF68] bg-[#FFF9E9] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7D6618]">
          Respuestas rápidas sugeridas en pantalla (Modo Mudo)
        </p>
        <div className="flex flex-wrap gap-2">
          {muteQuickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => handleSendWritten(reply, true, true)}
              className="min-h-[40px] rounded-xl border border-[#D9BF68] bg-white px-3 py-1.5 text-xs font-bold text-[#202020] hover:bg-[#F5DF91]"
            >
              {reply}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendWritten(writtenReply, false);
          }}
          className="flex flex-col gap-2 pt-1 sm:flex-row"
        >
          <label htmlFor="live-room-reply" className="sr-only">
            Escribe tu respuesta en la llamada
          </label>
          <input
            id="live-room-reply"
            type="text"
            value={writtenReply}
            onChange={(e) => setWrittenReply(e.target.value)}
            placeholder="Escribe tu respuesta aquí..."
            className="min-h-[46px] flex-1 rounded-xl border border-[#E9E5D9] bg-white px-3.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-4 text-xs font-bold text-[#202020] hover:bg-[#F7F5EE]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Enviar texto
            </button>
            <button
              type="button"
              onClick={() => handleSendWritten(writtenReply, true)}
              className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl bg-[#202020] px-4 text-xs font-bold text-white hover:bg-black"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Hablar por voz
            </button>
          </div>
        </form>
      </div>

      {/* Línea de tiempo de la sala */}
      <div className="max-h-80 space-y-2.5 overflow-y-auto rounded-2xl border border-[#E9E5D9] bg-[#FFFDF8] p-4">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-[#E9E5D9] bg-white p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-[#555555]">
              <span className="font-bold text-[#202020]">
                {entry.senderName} · {MODE_METADATA[entry.senderMode].shortLabel}
              </span>
              <span className="tabular-nums">
                {new Date(entry.createdAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="mt-1 font-medium text-[#202020]">{entry.text}</p>
            {entry.audioDataUrl && (
              <audio controls src={entry.audioDataUrl} className="mt-2 h-9 w-full max-w-sm" />
            )}
          </div>
        ))}
      </div>
      </div>
    </>
  );
};
