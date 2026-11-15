import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Globe,
  RefreshCw,
  Calendar,
  Award,
  Sparkles,
  BookOpen,
  Box,
  Mic,
  Volume2,
  Square,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-react';
import { LumiOrb } from './LumiOrb';
import type { AccessibilityMode, AppSectionId, LumiUser } from '../types/lumi';
import {
  MODE_METADATA,
  getPersonalGreeting,
  matchVoiceCommand,
} from '../utils/lumiLogic';
import {
  getLastSpokenText,
  isSpeechRecognitionSupported,
  speakBrowser,
  startSingleSpeechCapture,
  stopAllSpeech,
} from '../utils/speech';

interface HomeDashboardProps {
  mode: AccessibilityMode;
  alternativeControls: boolean;
  user: LumiUser | null;
  guestName: string;
  guestIdentity: string;
  onNavigate: (section: AppSectionId) => void;
  onChangeMode: () => void;
  onOpenAccount: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  mode,
  alternativeControls,
  user,
  guestName,
  guestIdentity,
  onNavigate,
  onChangeMode,
  onOpenAccount,
}) => {
  const [voiceFeedback, setVoiceFeedback] = useState(
    'Pulsa Escuchar comando para abrir una app diciendo su nombre (ej. Mensajes, Calendario, Certificados, Traductor).'
  );
  const [listening, setListening] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  } | null>(null);
  const [pwaInstalledMsg, setPwaInstalledMsg] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(
        e as unknown as {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
        }
      );
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setPwaInstalledMsg('Lumi se está instalando en tu dispositivo.');
      setInstallPromptEvent(null);
    }
  };

  const displayName = user?.name || guestName;
  const displayIdentity = user?.identity || guestIdentity;
  const greeting = getPersonalGreeting(displayIdentity, displayName);
  const modeInfo = MODE_METADATA[mode];

  const appCards: Array<{
    id: AppSectionId;
    title: string;
    subtitle: string;
    actionLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'mensajes',
      title: 'Mensajes y Salas en Vivo',
      subtitle: 'Chats multimodales, llamadas con grabación de audio, subtítulos y respuestas rápidas.',
      actionLabel: 'Abrir Mensajes y Salas',
      icon: <MessageSquare className="h-6 w-6 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'traductor',
      title: 'Traductor y Lengua de Señas',
      subtitle: 'Lectura fácil, pictogramas, idiomas y diccionario de lengua de señas integrado.',
      actionLabel: 'Abrir Traductor y Señas',
      icon: <RefreshCw className="h-6 w-6 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'calendario',
      title: 'Calendario y Recordatorios',
      subtitle: 'Hora, fecha y recordatorios permanentes por estado: Próximamente, Hoy y Finalizado.',
      actionLabel: 'Abrir Calendario',
      icon: <Calendar className="h-6 w-6 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'certificados',
      title: 'Certificados y Ayudas',
      subtitle: 'Guía personalizada según tu discapacidad sobre certificados y beneficios del gobierno.',
      actionLabel: 'Ver Certificados y Ayudas',
      icon: <Award className="h-6 w-6 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'social',
      title: 'Red social',
      subtitle: 'Comparte experiencias, escucha publicaciones y conversa en comunidad.',
      actionLabel: 'Abrir Red social',
      icon: <Globe className="h-6 w-6 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'asistente',
      title: 'Asistente Lumi',
      subtitle: 'Orientación inteligente por voz o texto adaptada a tu modo.',
      actionLabel: 'Hablar con Lumi',
      icon: <Sparkles className="h-6 w-6 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'audiolibros',
      title: 'Audiolibros',
      subtitle: 'Escucha historias y guías con capítulos, texto accesible y marcadores.',
      actionLabel: 'Escuchar Audiolibros',
      icon: <BookOpen className="h-6 w-6 text-[#202020]" aria-hidden="true" />,
    },
  ];

  const handleReadMenu = () => {
    speakBrowser(
      'Menú principal de Lumi. Tienes disponibles: Mensajes, Red social, Traductor de comunicación, Lengua de señas, Asistente Lumi, Audiolibros y Teléfono Cubo LumiCube.'
    );
  };

  const handleVoiceCommand = () => {
    if (!isSpeechRecognitionSupported()) {
      setVoiceFeedback('El reconocimiento de voz requiere Chrome o Edge actualizado.');
      return;
    }
    setListening(true);
    setVoiceFeedback('Escuchando comando... Di Mensajes, Red social, Traductor, Lengua de señas, Asistente o Audiolibros.');
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setListening(false);
        const cmd = matchVoiceCommand(transcript);
        if (cmd.type === 'navigate') {
          setVoiceFeedback(`Comando reconocido: "${transcript}". Abriendo sección...`);
          onNavigate(cmd.section);
        } else if (cmd.type === 'stop_speaking') {
          stopAllSpeech();
          setVoiceFeedback('Lectura detenida.');
        } else if (cmd.type === 'repeat') {
          const prev = getLastSpokenText();
          if (prev) speakBrowser(prev);
        } else if (cmd.type === 'help') {
          handleReadMenu();
        } else {
          setVoiceFeedback(`Escuché "${transcript}". Intenta decir el nombre de una aplicación.`);
        }
      },
      onError: (msg) => {
        setListening(false);
        setVoiceFeedback(msg);
      },
      onEnd: () => setListening(false),
    });
  };

  return (
    <div className="space-y-8">
      {/* Banner principal de bienvenida y modo */}
      <section className="lumi-card-futuristic rounded-2xl border border-[#D9BF68] bg-gradient-to-br from-[#FFF9E9] via-white to-[#FFFDF5] p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <LumiOrb size="md" active={listening} />
            <div>
              <p className="text-xs font-semibold text-[#7A611B]">
                {modeInfo.label} · {modeInfo.shortLabel}
                {alternativeControls ? ' · Controles adicionales activos' : ''}
              </p>
            <h1 className="mt-1 text-2xl font-bold text-[#202020] sm:text-3xl">
              {greeting}. ¡Bienvenido a Lumi!
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#444444]">
              {modeInfo.guidance}
            </p>
            {pwaInstalledMsg && (
              <p className="mt-2 text-xs font-bold text-[#1E5629]">{pwaInstalledMsg}</p>
            )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            {installPromptEvent && (
              <button
                type="button"
                onClick={handleInstallPwa}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#202020] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                <Smartphone className="h-4 w-4 text-[#F5DF91]" aria-hidden="true" />
                Instalar app
              </button>
            )}
            <button
              type="button"
              onClick={onChangeMode}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D9BF68] bg-white px-4 py-2 text-sm font-semibold text-[#202020] hover:bg-[#FDFBF6]"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Cambiar modo
            </button>
            {!user && (
              <button
                type="button"
                onClick={onOpenAccount}
                className="min-h-[44px] rounded-xl bg-[#F5DF91] px-4 py-2 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
              >
                Guardar cuenta Lumi
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Panel de control por voz (prioritario en Ciego o disponible en cualquier modo) */}
      <section
        aria-labelledby="voice-control-heading"
        className="rounded-2xl border border-[#E9E5D9] bg-white p-5"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 id="voice-control-heading" className="text-lg font-bold text-[#202020]">
              Control por voz y lectura accesible
            </h2>
            <p className="mt-1 text-sm text-[#555555]" aria-live="polite">
              {voiceFeedback}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={handleVoiceCommand}
              disabled={listening}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#F5DF91] px-4 py-2 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              {listening ? 'Escuchando...' : 'Escuchar comando'}
            </button>
            <button
              type="button"
              onClick={handleReadMenu}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-4 py-2 text-sm font-semibold text-[#202020]"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Leer menú
            </button>
            <button
              type="button"
              onClick={stopAllSpeech}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-4 py-2 text-sm font-semibold text-[#202020]"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Detener lectura
            </button>
          </div>
        </div>
      </section>

      {/* Las 6 aplicaciones principales de Lumi */}
      <section aria-labelledby="apps-grid-heading">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="apps-grid-heading" className="text-xl font-bold text-[#202020]">
            ¿Qué quieres hacer hoy?
          </h2>
          <span className="text-xs font-medium text-[#555555]">
            6 módulos activos
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
              className="group flex min-h-[164px] flex-col justify-between rounded-2xl border border-[#E9E5D9] bg-white p-5 text-left hover:border-[#D9BF68] hover:bg-[#FFF9E9]/50"
            >
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF9E9] ring-1 ring-[#E9E5D9]">
                  {card.icon}
                </div>
                <h3 className="mt-3.5 text-lg font-bold text-[#202020]">{card.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#555555]">
                  {card.subtitle}
                </p>
              </div>
              <span className="mt-4 inline-block text-xs font-bold text-[#7A611B] group-hover:underline">
                {card.actionLabel} →
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Tarjeta destacada del futuro Teléfono Cubo LumiCube (sin imagen en inicio; solo en el menú LumiCube) */}
      <section
        aria-labelledby="cube-banner-heading"
        className="rounded-2xl border border-[#E9E5D9] bg-white p-6"
      >
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#7A611B]">
            Hardware compañero
          </p>
          <h2 id="cube-banner-heading" className="text-2xl font-bold text-[#202020]">
            Conoce el futuro Teléfono Cubo con Lumi
          </h2>
          <p className="text-sm leading-relaxed text-[#555555]">
            Un dispositivo cúbico ergonómico con 6 caras funcionales, puntos Braille para grabar y pausar, botones grandes de navegación, pagos NFC por voz y sincronización total con esta aplicación.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onNavigate('lumicube')}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F5DF91] px-5 py-2.5 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
            >
              <Box className="h-4 w-4 text-[#EE7A13]" aria-hidden="true" />
              Abrir simulador de LumiCube
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
