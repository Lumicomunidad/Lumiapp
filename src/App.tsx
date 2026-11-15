import { useEffect, useRef, useState } from 'react';
import type {
  AccessibilityMode,
  AppSectionId,
  CubeButtonSpec,
  LumiReminder,
  LumiUser,
} from './types/lumi';
import { fetchCurrentUser } from './utils/api';
import { speakBrowser, speakWithBestVoice, stopAllSpeech } from './utils/speech';
import {
  computeReminderStatus,
  getCurrentTimeString,
  getTodayDateString,
  loadReminders,
  saveReminders,
} from './utils/reminders';
import { OnboardingFlow } from './components/OnboardingFlow';
import { TopNav } from './components/TopNav';
import { GlobalVoiceBar } from './components/GlobalVoiceBar';
import { HomeDashboard } from './components/HomeDashboard';
import { MessagesApp } from './components/MessagesApp';
import { SocialApp } from './components/SocialApp';
import { TranslatorApp } from './components/TranslatorApp';
import { CalendarApp } from './components/CalendarApp';
import { CertificatesApp } from './components/CertificatesApp';
import { AssistantApp } from './components/AssistantApp';
import { AudiobooksApp } from './components/AudiobooksApp';
import { LumiCubeStudio } from './components/LumiCubeStudio';
import { AccountModal } from './components/AccountModal';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<LumiUser | null>(null);
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  });

  const [mode, setMode] = useState<AccessibilityMode>('general');
  const [alternativeControls, setAlternativeControls] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestIdentity, setGuestIdentity] = useState('');
  const [activeSection, setActiveSection] = useState<AppSectionId>('home');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [reminders, setReminders] = useState<LumiReminder[]>(() => loadReminders());
  const [activeReminderAlert, setActiveReminderAlert] = useState<LumiReminder | null>(null);
  const sectionVoiceHandlerRef = useRef<((transcript: string) => string | null) | null>(null);
  const [cubeCommand, setCubeCommand] = useState<{
    action: string;
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((found) => {
        if (!mounted || !found) return;
        setUser(found);
        setMode(found.mode);
        setAlternativeControls(found.alternativeControls);
        setGuestName(found.name);
        setGuestIdentity(found.identity);
        setOnboarded(true);
      })
      .finally(() => {
        if (mounted) setBooting(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stopAllSpeech();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleUpdateReminders = (next: LumiReminder[]) => {
    setReminders(next);
    saveReminders(next);
  };

  // Vigilante global de recordatorios: actualiza estados y avisa a la hora exacta
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const today = getTodayDateString(now);
      const currentHHMM = getCurrentTimeString(now);
      let changed = false;

      const updated = reminders.map((rem) => {
        const nextStatus = computeReminderStatus(rem.date, rem.status, now);
        let nextNotifiedAt = rem.notifiedAt;

        if (
          nextStatus === 'hoy' &&
          rem.date === today &&
          rem.time === currentHHMM &&
          !rem.notifiedAt
        ) {
          nextNotifiedAt = now.toISOString();
          changed = true;
          setActiveReminderAlert({ ...rem, status: nextStatus, notifiedAt: nextNotifiedAt });
          speakWithBestVoice(`Recordatorio de Lumi para hoy a las ${rem.time}: ${rem.title}`);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([250, 120, 250]);
          }
        } else if (nextStatus !== rem.status) {
          changed = true;
        }

        return { ...rem, status: nextStatus, notifiedAt: nextNotifiedAt };
      });

      if (changed) {
        setReminders(updated);
        saveReminders(updated);
      }
    };

    checkReminders();
    const id = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(id);
  }, [reminders]);

  const handleNavigate = (section: AppSectionId) => {
    stopAllSpeech();
    if (section === 'senas') {
      setActiveSection('traductor');
      window.setTimeout(() => {
        document.getElementById('senas-integrado')?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
      return;
    }
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthenticated = (authenticatedUser: LumiUser) => {
    setUser(authenticatedUser);
    setMode(authenticatedUser.mode);
    setAlternativeControls(authenticatedUser.alternativeControls);
    setGuestName(authenticatedUser.name);
    setGuestIdentity(authenticatedUser.identity);
    setOnboarded(true);
    setActiveSection('home');
  };

  const handleCubeButtonPress = (btn: CubeButtonSpec) => {
    setCubeCommand({ action: btn.action, timestamp: Date.now() });
    if (btn.action === 'power_menu') {
      speakBrowser('Botón uno: Menú principal.');
      handleNavigate('home');
    } else if (btn.action === 'cancel') {
      speakBrowser('Botón nueve: Volver al menú.');
      handleNavigate('home');
    } else if (btn.action === 'stop') {
      stopAllSpeech();
    } else if (btn.action === 'play') {
      speakBrowser('Botón tres: Reproducir.');
    } else if (btn.action === 'pause') {
      stopAllSpeech();
      speakBrowser('Botón cuatro: Pausar.');
    } else if (btn.action === 'record') {
      speakBrowser('Botón dos: Grabar idea o mensaje.');
    } else if (btn.action === 'confirm') {
      speakBrowser('Botón ocho: Confirmado.');
    } else if (btn.action === 'prev') {
      speakBrowser('Botón seis: Anterior.');
    } else if (btn.action === 'next') {
      speakBrowser('Botón siete: Siguiente.');
    }
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm font-medium text-[#555555]">
        Cargando Lumi...
      </div>
    );
  }

  if (!onboarded) {
    return (
      <OnboardingFlow
        initialMode={mode === 'general' ? '' : mode}
        initialName={guestName}
        initialIdentity={guestIdentity}
        initialAltControls={alternativeControls}
        onCompleteGuest={(config) => {
          setMode(config.mode);
          setGuestName(config.name);
          setGuestIdentity(config.identity);
          setAlternativeControls(config.alternativeControls);
          setOnboarded(true);
          setActiveSection('home');
        }}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const effectiveMode = user?.mode ?? mode;
  const effectiveAlt = user?.alternativeControls ?? alternativeControls;
  const effectiveName = user?.name ?? guestName;

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202020]">
      <TopNav
        activeSection={activeSection}
        user={user}
        guestName={guestName}
        onNavigate={handleNavigate}
        onOpenAccount={() => setAccountModalOpen(true)}
      />

      <GlobalVoiceBar
        mode={effectiveMode}
        onNavigate={handleNavigate}
        onUnhandledTranscript={(transcript) => {
          if (
            (activeSection === 'mensajes' ||
              activeSection === 'calendario' ||
              activeSection === 'audiolibros') &&
            sectionVoiceHandlerRef.current
          ) {
            return sectionVoiceHandlerRef.current(transcript);
          }
          return null;
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {activeReminderAlert && (
          <div
            role="alert"
            className="lumi-flash-banner mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#DC2626] bg-[#FEE2E2] p-4 text-[#991B1B]"
          >
            <div>
              <p className="text-xs font-extrabold uppercase">Aviso de Lumi · Recordatorio de Hoy</p>
              <p className="text-base font-bold">
                {activeReminderAlert.time} — {activeReminderAlert.title}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  handleUpdateReminders(
                    reminders.map((r) =>
                      r.id === activeReminderAlert.id
                        ? { ...r, status: 'finalizado', updatedAt: new Date().toISOString() }
                        : r
                    )
                  );
                  setActiveReminderAlert(null);
                }}
                className="min-h-[40px] rounded-xl bg-[#171717] px-3.5 text-xs font-bold text-white hover:bg-black"
              >
                Marcar Finalizado
              </button>
              <button
                type="button"
                onClick={() => setActiveReminderAlert(null)}
                className="min-h-[40px] rounded-xl border border-[#DC2626] bg-white px-3.5 text-xs font-bold text-[#991B1B]"
              >
                Cerrar aviso
              </button>
            </div>
          </div>
        )}
        {activeSection === 'home' && (
          <HomeDashboard
            mode={effectiveMode}
            alternativeControls={effectiveAlt}
            user={user}
            guestName={guestName}
            guestIdentity={guestIdentity}
            onNavigate={handleNavigate}
            onChangeMode={() => {
              if (user) {
                setAccountModalOpen(true);
              } else {
                setOnboarded(false);
              }
            }}
            onOpenAccount={() => setAccountModalOpen(true)}
          />
        )}

        {activeSection === 'mensajes' && (
          <MessagesApp
            mode={effectiveMode}
            alternativeControls={effectiveAlt}
            userName={effectiveName}
            registerVoiceHandler={(handler) => {
              sectionVoiceHandlerRef.current = handler;
            }}
            onBack={() => handleNavigate('home')}
          />
        )}

        {activeSection === 'social' && (
          <SocialApp
            mode={effectiveMode}
            authorName={effectiveName}
            onBack={() => handleNavigate('home')}
          />
        )}

        {activeSection === 'traductor' && (
          <TranslatorApp onBack={() => handleNavigate('home')} />
        )}

        {activeSection === 'calendario' && (
          <CalendarApp
            mode={effectiveMode}
            reminders={reminders}
            onUpdateReminders={handleUpdateReminders}
            registerVoiceHandler={(handler) => {
              sectionVoiceHandlerRef.current = handler;
            }}
            onBack={() => handleNavigate('home')}
          />
        )}

        {activeSection === 'certificados' && (
          <CertificatesApp
            mode={effectiveMode}
            onBack={() => handleNavigate('home')}
          />
        )}

        {activeSection === 'asistente' && (
          <AssistantApp
            mode={effectiveMode}
            userName={effectiveName}
            onBack={() => handleNavigate('home')}
            onNavigate={handleNavigate}
          />
        )}

        {activeSection === 'audiolibros' && (
          <AudiobooksApp
            onBack={() => handleNavigate('home')}
            externalCubeCommand={cubeCommand}
            registerVoiceHandler={(handler) => {
              sectionVoiceHandlerRef.current = handler;
            }}
          />
        )}

        {activeSection === 'lumicube' && (
          <LumiCubeStudio
            user={user}
            onUserUpdated={(updated) => setUser(updated)}
            onCubeButtonPress={handleCubeButtonPress}
            onBack={() => handleNavigate('home')}
          />
        )}
      </main>

      <footer className="border-t border-[#E9E5D9] bg-white px-4 py-5 text-center text-xs text-[#555555]">
        <p className="font-semibold text-[#202020]">
          Lumi · Comunicación accesible para todos · Más independencia, más inclusión
        </p>
        <p className="mt-1 text-[11px] text-[#555555]">
          © {new Date().getFullYear()} Dilan Adrian Lopez Ramirez · Todos los derechos reservados
        </p>
      </footer>

      <AccountModal
        open={accountModalOpen}
        user={user}
        currentMode={effectiveMode}
        currentName={effectiveName}
        currentIdentity={user?.identity ?? guestIdentity}
        currentAltControls={effectiveAlt}
        onClose={() => setAccountModalOpen(false)}
        onAuthSuccess={handleAuthenticated}
        onGuestProfileUpdate={(patch) => {
          setMode(patch.mode);
          setGuestName(patch.name);
          setGuestIdentity(patch.identity);
          setAlternativeControls(patch.alternativeControls);
        }}
        onLoggedOut={() => {
          setUser(null);
          setGuestName('');
          setGuestIdentity('');
        }}
      />
    </div>
  );
}
