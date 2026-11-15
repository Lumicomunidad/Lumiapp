import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import type { AccessibilityMode, AppSectionId } from '../types/lumi';
import { matchVoiceCommand } from '../utils/lumiLogic';
import {
  getLastSpokenText,
  isSpeechRecognitionSupported,
  speakBrowser,
  startContinuousVoiceCommandListener,
  stopAllSpeech,
} from '../utils/speech';

interface GlobalVoiceBarProps {
  mode: AccessibilityMode;
  onNavigate: (section: AppSectionId) => void;
  onUnhandledTranscript?: (transcript: string) => string | null;
}

const SECTION_NAMES: Record<AppSectionId, string> = {
  home: 'Inicio',
  mensajes: 'Mensajes y Salas',
  social: 'Red social',
  traductor: 'Traductor y Lengua de señas',
  senas: 'Lengua de señas',
  calendario: 'Calendario y Recordatorios',
  certificados: 'Certificados y Ayudas',
  asistente: 'Asistente Lumi',
  audiolibros: 'Audiolibros',
  lumicube: 'LumiCube',
};

export const GlobalVoiceBar: React.FC<GlobalVoiceBarProps> = ({
  mode,
  onNavigate,
  onUnhandledTranscript,
}) => {
  const shouldAutoEnable = mode === 'ciego' || mode === 'sordo';
  const [voiceActive, setVoiceActive] = useState(shouldAutoEnable);
  const [writtenResponse, setWrittenResponse] = useState<string>(() =>
    mode === 'sordo'
      ? 'Comandos de voz activos en todos los menús. Di "Mensajes", "Traductor", "Calendario", "Certificados" o "Desactivar voz".'
      : mode === 'ciego'
        ? 'Escucha continua activa en todos los menús. Di el nombre de cualquier sección.'
        : 'Comandos de voz disponibles.'
  );
  const [lastHeard, setLastHeard] = useState('');
  const [micError, setMicError] = useState('');
  const [pausedForRecording, setPausedForRecording] = useState(false);

  const stopListenerRef = useRef<(() => void) | null>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const onUnhandledRef = useRef(onUnhandledTranscript);
  onUnhandledRef.current = onUnhandledTranscript;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ recording?: boolean }>).detail;
      setPausedForRecording(Boolean(detail?.recording));
    };
    window.addEventListener('lumi:recording-state', handler);
    return () => window.removeEventListener('lumi:recording-state', handler);
  }, []);

  // Al cambiar de modo entre ciego/sordo/otros, ajusta el estado inicial
  useEffect(() => {
    if (mode === 'ciego' || mode === 'sordo') {
      setVoiceActive(true);
      setWrittenResponse(
        mode === 'sordo'
          ? 'Comandos de voz activos. Lumi responderá por escrito aquí. Di "Desactivar voz" para apagarlos.'
          : 'Comandos de voz continuos activos en todos los menús.'
      );
    } else {
      setVoiceActive(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!voiceActive || pausedForRecording) {
      stopListenerRef.current?.();
      stopListenerRef.current = null;
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setMicError('El reconocimiento continuo requiere Google Chrome o Microsoft Edge.');
      return;
    }

    setMicError('');
    const stop = startContinuousVoiceCommandListener({
      onResult: (transcript) => {
        setLastHeard(transcript);
        const cmd = matchVoiceCommand(transcript);
        const currentMode = modeRef.current;

        if (cmd.type === 'disable_voice') {
          setVoiceActive(false);
          const msg =
            'Comandos de voz desactivados por voz. Pulsa "Activar voz" si deseas volver a usarlos.';
          setWrittenResponse(msg);
          if (currentMode !== 'sordo') {
            speakBrowser(msg);
          }
          return;
        }

        // Primero permite que la sección activa (ej. Mensajes, Audiolibros, Calendario) maneje comandos específicos
        const sectionReply = onUnhandledRef.current?.(transcript);
        if (sectionReply) {
          const isSilent = sectionReply.startsWith('[SILENT]');
          const cleanReply = isSilent ? sectionReply.slice(8).trim() : sectionReply;
          setWrittenResponse(cleanReply);
          if (!isSilent && currentMode !== 'sordo') {
            speakBrowser(cleanReply);
          }
          return;
        }

        if (cmd.type === 'navigate') {
          const sectionTitle = SECTION_NAMES[cmd.section];
          const reply = `Abriendo ${sectionTitle}.`;
          setWrittenResponse(reply);
          if (currentMode !== 'sordo') {
            speakBrowser(reply);
          }
          onNavigateRef.current(cmd.section);
          return;
        }

        if (cmd.type === 'stop_speaking') {
          stopAllSpeech();
          setWrittenResponse('Lectura detenida.');
          return;
        }

        if (cmd.type === 'repeat') {
          const prev = getLastSpokenText();
          if (prev) {
            setWrittenResponse(`Repetición: ${prev}`);
            if (currentMode !== 'sordo') speakBrowser(prev);
          }
          return;
        }

        if (cmd.type === 'help') {
          const helpMsg =
            'Puedes decir: Inicio, Mensajes, Traductor, Señas, Calendario, Certificados, Audiolibros, LumiCube o Desactivar voz.';
          setWrittenResponse(helpMsg);
          if (currentMode !== 'sordo') speakBrowser(helpMsg);
          return;
        }

        setWrittenResponse(
          `Escuché "${transcript}". Di el nombre de un menú (ej. Mensajes, Calendario, Traductor) o "Desactivar voz".`
        );
      },
      onError: (msg, fatal) => {
        setMicError(msg);
        if (fatal) {
          setVoiceActive(false);
        }
      },
    });

    stopListenerRef.current = stop;
    return () => {
      stop?.();
      stopListenerRef.current = null;
    };
  }, [voiceActive, pausedForRecording]);

  if (!shouldAutoEnable && !voiceActive) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Barra global de comandos por voz"
      className="border-b border-[#E9E5D9] bg-[#FFFDF5] px-4 py-2.5 sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              voiceActive ? 'bg-[#F5DF91] text-[#202020]' : 'bg-[#E9E5D9] text-[#555555]'
            }`}
            aria-hidden="true"
          >
            {voiceActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </span>
          <div className="min-w-0 text-xs">
            <p className="font-bold text-[#202020]">
              {voiceActive
                ? mode === 'sordo'
                  ? 'Voz continua activa (Modo Sordo · respuesta escrita)'
                  : 'Voz continua activa en todos los menús'
                : 'Comandos de voz desactivados'}
              {lastHeard ? ` · Último: "${lastHeard}"` : ''}
            </p>
            <p aria-live="polite" className="mt-0.5 font-medium text-[#444444]">
              {micError || writtenResponse}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mode !== 'sordo' && (
            <button
              type="button"
              onClick={() => speakBrowser(writtenResponse)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-3 text-xs font-semibold text-[#202020] hover:bg-[#F7F5EE]"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              Leer
            </button>
          )}
          <button
            type="button"
            onClick={() => setVoiceActive((v) => !v)}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold ${
              voiceActive
                ? 'border border-[#DC2626] bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]'
                : 'bg-[#F5DF91] text-[#202020] hover:bg-[#EDD37A]'
            }`}
          >
            {voiceActive ? 'Desactivar voz' : 'Activar voz'}
          </button>
        </div>
      </div>
    </div>
  );
};
