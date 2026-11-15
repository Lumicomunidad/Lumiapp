import React, { useEffect, useState } from 'react';
import { Volume2, PenLine, Eye, EyeOff, Sparkles, Mic, ArrowRight, UserPlus } from 'lucide-react';
import { LumiLogo } from './LumiLogo';
import type { AccessibilityMode, LumiUser } from '../types/lumi';
import {
  IDENTITY_OPTIONS,
  MODE_METADATA,
  matchIdentityFromSpeech,
  matchModeFromSpeech,
  parseSpokenEmail,
  parseSpokenPassword,
  validateAccountInput,
} from '../utils/lumiLogic';
import {
  isSpeechRecognitionSupported,
  speakBrowser,
  startSingleSpeechCapture,
  stopAllSpeech,
} from '../utils/speech';
import { loginAccount, registerAccount } from '../utils/api';

interface OnboardingFlowProps {
  initialMode: AccessibilityMode | '';
  initialName: string;
  initialIdentity: string;
  initialAltControls: boolean;
  onCompleteGuest: (config: {
    mode: AccessibilityMode;
    name: string;
    identity: string;
    alternativeControls: boolean;
  }) => void;
  onAuthenticated: (user: LumiUser) => void;
}

type OnboardingStep = 'profile' | 'name' | 'identity' | 'account';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  initialMode,
  initialName,
  initialIdentity,
  initialAltControls,
  onCompleteGuest,
  onAuthenticated,
}) => {
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [mode, setMode] = useState<AccessibilityMode | ''>(initialMode);
  const [alternativeControls, setAlternativeControls] = useState(initialAltControls);
  const [name, setName] = useState(initialName);
  const [identity, setIdentity] = useState(initialIdentity);
  const [voiceStatus, setVoiceStatus] = useState(
    'Puedes responder con tu voz activando el micrófono o elegir una opción con el tacto.'
  );
  const [isListening, setIsListening] = useState(false);

  // Account step state
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountVoiceStatus, setAccountVoiceStatus] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (step !== 'account') return;
    if (mode === 'ciego' && !alternativeControls) {
      const prompt =
        'Paso final: guarda tu cuenta Lumi. Antes de continuar, por favor escribe o dicta tu correo electrónico y una contraseña de al menos seis caracteres.';
      setAccountVoiceStatus(prompt);
      speakBrowser(prompt);
    } else {
      setAccountVoiceStatus('');
    }
    return () => {
      stopAllSpeech();
    };
  }, [step, mode, alternativeControls]);

  const profileCards: Array<{
    id: AccessibilityMode;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'ciego',
      title: 'CIEGO',
      subtitle: 'Modo principalmente por audio',
      icon: <Volume2 className="mx-auto mb-2 h-7 w-7 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'mudo',
      title: 'MUDO',
      subtitle: 'Modo visual y escrito',
      icon: <PenLine className="mx-auto mb-2 h-7 w-7 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'sordo',
      title: 'SORDO',
      subtitle: 'Modo visual y lengua de señas',
      icon: <Eye className="mx-auto mb-2 h-7 w-7 text-[#202020]" aria-hidden="true" />,
    },
    {
      id: 'general',
      title: 'NINGUNA DE ELLAS',
      subtitle: 'Modo general multimodal',
      icon: <Sparkles className="mx-auto mb-2 h-7 w-7 text-[#202020]" aria-hidden="true" />,
    },
  ];

  const handleStartVoiceProfile = () => {
    if (!isSpeechRecognitionSupported()) {
      const msg =
        'Este navegador no soporta reconocimiento de voz directo. Puedes elegir tu modo con el tacto.';
      setVoiceStatus(msg);
      speakBrowser(msg);
      return;
    }
    setIsListening(true);
    setVoiceStatus('Escuchando... Di Ciego, Mudo, Sordo o Ninguna de ellas.');
    speakBrowser('Hola, soy Lumi. Di Ciego, Mudo, Sordo o Ninguna de ellas.', {
      onEnd: () => {
        startSingleSpeechCapture({
          onResult: (transcript) => {
            setIsListening(false);
            const matched = matchModeFromSpeech(transcript);
            if (!matched) {
              setVoiceStatus(
                `Escuché "${transcript}". Intenta decir Ciego, Mudo, Sordo o Ninguna de ellas.`
              );
              return;
            }
            setMode(matched);
            setVoiceStatus(`Modo seleccionado: ${MODE_METADATA[matched].label}.`);
            if (matched === 'sordo') {
              setStep('name');
            } else {
              speakBrowser(
                `Elegiste el modo ${MODE_METADATA[matched].label}. Vamos con tu nombre.`,
                { onEnd: () => setStep('name') }
              );
            }
          },
          onError: (err) => {
            setIsListening(false);
            setVoiceStatus(err);
          },
          onEnd: () => setIsListening(false),
        });
      },
    });
  };

  const handleListenName = () => {
    if (!isSpeechRecognitionSupported()) {
      setVoiceStatus('Reconocimiento de voz no disponible en este navegador.');
      return;
    }
    setIsListening(true);
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setIsListening(false);
        setName(transcript);
      },
      onError: (err) => {
        setIsListening(false);
        setVoiceStatus(err);
      },
      onEnd: () => setIsListening(false),
    });
  };

  const handleListenIdentity = () => {
    if (!isSpeechRecognitionSupported()) return;
    setIsListening(true);
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setIsListening(false);
        const matched = matchIdentityFromSpeech(transcript);
        if (matched === 'omitir') {
          setIdentity('');
          setStep('account');
        } else if (matched) {
          setIdentity(matched);
        }
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false),
    });
  };

  const handleListenEmail = () => {
    if (!isSpeechRecognitionSupported()) {
      setAccountVoiceStatus('El dictado por voz requiere Chrome o Edge.');
      return;
    }
    const startCapture = () => {
      setIsListening(true);
      setAccountVoiceStatus('Escuchando tu correo electrónico (ej. "nombre arroba gmail punto com")...');
      startSingleSpeechCapture({
        onResult: (transcript) => {
          setIsListening(false);
          const parsed = parseSpokenEmail(transcript);
          setEmail(parsed);
          const msg = `Correo anotado: ${parsed}`;
          setAccountVoiceStatus(msg);
          if (mode === 'ciego' && !alternativeControls) {
            speakBrowser(msg);
          }
        },
        onError: (err) => {
          setIsListening(false);
          setAccountVoiceStatus(err);
        },
        onEnd: () => setIsListening(false),
      });
    };

    if (mode === 'ciego' && !alternativeControls) {
      speakBrowser('Dicta tu correo electrónico, por ejemplo nombre arroba gmail punto com.', {
        onEnd: startCapture,
      });
    } else {
      startCapture();
    }
  };

  const handleListenPassword = () => {
    if (!isSpeechRecognitionSupported()) {
      setAccountVoiceStatus('El dictado por voz requiere Chrome o Edge.');
      return;
    }
    const startCapture = () => {
      setIsListening(true);
      setAccountVoiceStatus('Escuchando tu contraseña (mínimo 6 caracteres)...');
      startSingleSpeechCapture({
        onResult: (transcript) => {
          setIsListening(false);
          const parsed = parseSpokenPassword(transcript);
          setPassword(parsed);
          const msg = `Contraseña anotada (${parsed.length} caracteres).`;
          setAccountVoiceStatus(msg);
          if (mode === 'ciego' && !alternativeControls) {
            speakBrowser(msg);
          }
        },
        onError: (err) => {
          setIsListening(false);
          setAccountVoiceStatus(err);
        },
        onEnd: () => setIsListening(false),
      });
    };

    if (mode === 'ciego' && !alternativeControls) {
      speakBrowser('Dicta tu contraseña de al menos seis caracteres.', {
        onEnd: startCapture,
      });
    } else {
      startCapture();
    }
  };

  const handleContinueProfile = () => {
    if (!mode) {
      const msg = 'Por favor, elige un modo de accesibilidad antes de continuar.';
      setVoiceStatus(msg);
      speakBrowser(msg);
      return;
    }
    stopAllSpeech();
    setStep('name');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const effectiveMode: AccessibilityMode = mode || 'general';
    const effectiveName = name.trim() || email.split('@')[0] || 'Usuario Lumi';
    const validation = validateAccountInput({
      name: effectiveName,
      email,
      password,
      isRegister: authTab === 'register',
    });
    if (!validation.valid) {
      setAuthError(validation.error || 'Revisa los datos ingresados.');
      return;
    }
    setAuthBusy(true);
    try {
      if (authTab === 'register') {
        const res = await registerAccount({
          name: effectiveName,
          email,
          password,
          mode: effectiveMode,
          alternativeControls,
          identity,
        });
        onAuthenticated(res.user);
      } else {
        const res = await loginAccount({ email, password });
        onAuthenticated(res.user);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo completar el acceso.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEnterAsGuest = () => {
    stopAllSpeech();
    onCompleteGuest({
      mode: mode || 'general',
      name: name.trim(),
      identity,
      alternativeControls,
    });
  };

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl">
        {/* Cabecera de bienvenida */}
        <div className="flex flex-col items-center text-center">
          <LumiLogo size="lg" className="mb-3" />
          <h1 className="text-3xl font-bold tracking-tight text-[#202020] sm:text-4xl">
            Hola, soy <span className="text-[#B3932A]">Lumi</span>
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#555555]">
            Tu espacio de comunicación accesible. Lumi puede guiarte hablando, por texto o apoyos visuales, y se conecta con el futuro ecosistema LumiCube.
          </p>
        </div>

        {/* Paso 1: Elección del modo */}
        {step === 'profile' && (
          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-5 lg:col-span-7">
              <div className="rounded-2xl border border-[#E9E5D9] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#202020]">
                      1. Elige cómo prefieres comunicarte
                    </h2>
                    <p className="mt-1 text-sm text-[#555555]" aria-live="polite">
                      {voiceStatus}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartVoiceProfile}
                    disabled={isListening}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#F5DF91] px-4 py-2.5 text-sm font-semibold text-[#202020] hover:bg-[#EDD37A] disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4" aria-hidden="true" />
                    {isListening ? 'Escuchando...' : 'Comenzar por voz'}
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {profileCards.map((card) => {
                    const selected = mode === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setMode(card.id)}
                        aria-pressed={selected}
                        className={`min-h-[128px] rounded-2xl border-2 p-5 text-center transition-colors ${
                          selected
                            ? 'border-[#EE7A13] bg-[#FFF9E9] ring-2 ring-[#EE7A13]/25'
                            : 'border-[#E9E5D9] bg-white hover:border-[#EE7A13]/50 hover:bg-[#FDFBF4]'
                        }`}
                      >
                        {card.icon}
                        <strong className="block text-base font-bold text-[#202020]">
                          {card.title}
                        </strong>
                        <span className="mt-1 block text-xs text-[#555555]">
                          {card.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <label className="mt-5 flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] p-3.5 text-sm text-[#202020]">
                  <input
                    type="checkbox"
                    checked={alternativeControls}
                    onChange={(e) => setAlternativeControls(e.target.checked)}
                    className="mt-0.5 h-5 w-5 accent-[#C6A73E]"
                  />
                  <span>
                    Necesito combinar mi modo con controles adicionales (por ejemplo, teclado, lectura fácil o apoyos visuales).
                  </span>
                </label>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setStep('account');
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-4 py-2.5 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Ya tengo cuenta / Iniciar sesión
                  </button>

                  <button
                    type="button"
                    onClick={handleContinueProfile}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F5DF91] px-6 py-3 text-base font-bold text-[#202020] hover:bg-[#EDD37A]"
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tarjeta informativa de LumiCube a la derecha */}
            <aside className="rounded-2xl border border-[#E9E5D9] bg-[#FFF9E9] p-5 lg:col-span-5">
              <p className="text-xs font-semibold text-[#7A611B]">
                Ecosistema físico a futuro
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#202020]">
                Teléfono Cubo con Lumi (LumiCube)
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#4A4331]">
                Diseñado para brindar más independencia e inclusión: 6 caras con botones táctiles, puntos Braille, asistente de voz Lumi, audio claro y pagos NFC por voz.
              </p>
              <p className="mt-3 text-xs text-[#6B5D3B]">
                Dentro de la app podrás probar el simulador interactivo de los 9 botones de LumiCube y ver su diseño completo en el menú.
              </p>
            </aside>
          </div>
        )}

        {/* Paso 2: Nombre */}
        {step === 'name' && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#E9E5D9] bg-white p-6">
            <h2 className="text-2xl font-bold text-[#202020]">2. ¿Cómo te llamas?</h2>
            <p className="mt-1 text-sm text-[#555555]">
              Puedes escribir tu nombre, dictarlo por voz o dejarlo en blanco.
            </p>

            <label htmlFor="onboarding-name" className="mt-4 block text-sm font-semibold text-[#202020]">
              Tu nombre
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="onboarding-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Escribe tu nombre"
                autoComplete="given-name"
                className="min-h-[48px] flex-1 rounded-xl border border-[#D8D3C5] bg-white px-4 py-3 text-base text-[#202020]"
              />
              <button
                type="button"
                onClick={handleListenName}
                className="min-h-[48px] rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-4 text-sm font-semibold text-[#202020] hover:bg-[#F5DF91]/30"
                aria-label="Dictar tu nombre por voz"
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('profile')}
                className="min-h-[48px] rounded-xl bg-[#F1EFEA] px-5 py-3 text-sm font-semibold text-[#202020] hover:bg-[#E7E3D8]"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => setStep('identity')}
                className="min-h-[48px] rounded-xl bg-[#F5DF91] px-6 py-3 text-base font-bold text-[#202020] hover:bg-[#EDD37A]"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Paso 3: Identidad opcional */}
        {step === 'identity' && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#E9E5D9] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#202020]">3. ¿Cómo te identificas?</h2>
                <p className="mt-1 text-sm text-[#555555]">
                  Esta pregunta es opcional y ayuda a personalizar el saludo de Lumi. No limita ninguna función.
                </p>
              </div>
              <button
                type="button"
                onClick={handleListenIdentity}
                className="min-h-[44px] shrink-0 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3 text-sm font-semibold text-[#202020]"
                aria-label="Responder identidad por voz"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {IDENTITY_OPTIONS.map((option) => {
                const checked = identity === option;
                return (
                  <label
                    key={option}
                    className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                      checked
                        ? 'border-[#D9BF68] bg-[#FFF9E9] text-[#202020]'
                        : 'border-[#E9E5D9] bg-white text-[#202020] hover:bg-[#FDFBF6]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="identity"
                      value={option}
                      checked={checked}
                      onChange={() => setIdentity(option)}
                      className="h-4 w-4 accent-[#C6A73E]"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('name')}
                className="min-h-[48px] rounded-xl bg-[#F1EFEA] px-5 py-3 text-sm font-semibold text-[#202020]"
              >
                Atrás
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIdentity('');
                    setStep('account');
                  }}
                  className="min-h-[48px] rounded-xl bg-[#F1EFEA] px-5 py-3 text-sm font-semibold text-[#202020]"
                >
                  Omitir
                </button>
                <button
                  type="button"
                  onClick={() => setStep('account')}
                  className="min-h-[48px] rounded-xl bg-[#F5DF91] px-6 py-3 text-base font-bold text-[#202020] hover:bg-[#EDD37A]"
                >
                  Siguiente: Tu cuenta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Paso 4: Crear cuenta en Lumi o entrar directo */}
        {step === 'account' && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#E9E5D9] bg-white p-6">
            <h2 className="text-2xl font-bold text-[#202020]">
              4. Guarda tu perfil en tu cuenta Lumi
            </h2>
            <p className="mt-1 text-sm text-[#555555]">
              Crea una cuenta para guardar tu modo de accesibilidad, mensajes, publicaciones y progreso en audiolibros, o entra ahora como invitado.
            </p>

            {/* Pregunta previa adaptada según el modo elegido */}
            <div
              className="mt-4 rounded-xl border border-[#EE7A13]/45 bg-[#FFF9E9] p-3.5 text-sm text-[#202020]"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#B85706]">
                    {mode === 'ciego'
                      ? 'Asistencia por voz para tu cuenta'
                      : mode === 'sordo'
                        ? 'Antes de ingresar tu correo electrónico:'
                        : 'Puedes escribir o dictar tus datos:'}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#4A4331]">
                    {accountVoiceStatus ||
                      (mode === 'sordo'
                        ? 'Por favor ingresa o dicta con el micrófono tu correo electrónico y una contraseña (mínimo 6 caracteres) para guardar tu perfil en Lumi.'
                        : 'Usa los botones de micrófono junto a correo y contraseña si prefieres dictarlos por voz.')}
                  </p>
                </div>
                {mode === 'ciego' && (
                  <button
                    type="button"
                    onClick={() =>
                      speakBrowser(
                        'Antes de continuar, por favor escribe o dicta tu correo electrónico y una contraseña de al menos seis caracteres usando los botones de micrófono.'
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#EE7A13]/50 bg-white px-3 py-1.5 text-xs font-bold text-[#202020] hover:bg-[#FFFDF8]"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-[#EE7A13]" aria-hidden="true" />
                    Escuchar pregunta
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2 rounded-xl bg-[#F7F5EE] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setAuthError('');
                }}
                className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  authTab === 'register'
                    ? 'border-b-2 border-[#EE7A13] bg-white text-[#202020] shadow-xs'
                    : 'text-[#555555] hover:text-[#202020]'
                }`}
              >
                Crear cuenta Lumi
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setAuthError('');
                }}
                className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  authTab === 'login'
                    ? 'border-b-2 border-[#EE7A13] bg-white text-[#202020] shadow-xs'
                    : 'text-[#555555] hover:text-[#202020]'
                }`}
              >
                Iniciar sesión
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3" noValidate>
              {authTab === 'register' && (
                <div>
                  <label htmlFor="acc-name" className="block text-sm font-semibold text-[#202020]">
                    Nombre en Lumi
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="acc-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Elena Torres"
                      className="min-h-[46px] flex-1 rounded-xl border border-[#D8D3C5] px-4 py-2.5 text-sm text-[#202020]"
                    />
                    <button
                      type="button"
                      onClick={handleListenName}
                      disabled={isListening}
                      aria-label="Dictar nombre por voz"
                      title="Dictar nombre"
                      className="min-h-[46px] rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3.5 text-[#202020] hover:border-[#EE7A13] hover:bg-[#FFF9E9] disabled:opacity-60"
                    >
                      <Mic className="h-4 w-4 text-[#EE7A13]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="acc-email" className="block text-sm font-semibold text-[#202020]">
                  Correo electrónico
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="acc-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    autoComplete="email"
                    className="min-h-[46px] flex-1 rounded-xl border border-[#D8D3C5] px-4 py-2.5 text-sm text-[#202020]"
                  />
                  <button
                    type="button"
                    onClick={handleListenEmail}
                    disabled={isListening}
                    aria-label="Dictar correo electrónico por voz"
                    title="Dictar correo (ej. nombre arroba gmail punto com)"
                    className="min-h-[46px] rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3.5 text-[#202020] hover:border-[#EE7A13] hover:bg-[#FFF9E9] disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4 text-[#EE7A13]" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="acc-password" className="block text-sm font-semibold text-[#202020]">
                  Contraseña (mínimo 6 caracteres)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="acc-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={authTab === 'register' ? 'new-password' : 'current-password'}
                    className="min-h-[46px] flex-1 rounded-xl border border-[#D8D3C5] px-4 py-2.5 text-sm text-[#202020]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="min-h-[46px] rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3 text-[#202020] hover:border-[#EE7A13]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleListenPassword}
                    disabled={isListening}
                    aria-label="Dictar contraseña por voz"
                    title="Dictar contraseña"
                    className="min-h-[46px] rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3.5 text-[#202020] hover:border-[#EE7A13] hover:bg-[#FFF9E9] disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4 text-[#EE7A13]" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#E5B8B8] bg-[#FDF1F1] px-4 py-3 text-sm font-medium text-[#7D2828]"
                >
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="min-h-[48px] w-full rounded-xl bg-[#F5DF91] px-5 py-3 text-base font-bold text-[#202020] hover:bg-[#EDD37A] disabled:opacity-60"
              >
                {authBusy
                  ? 'Procesando...'
                  : authTab === 'register'
                    ? 'Crear mi cuenta y entrar a Lumi'
                    : 'Iniciar sesión y entrar'}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E5D9] pt-4">
              <button
                type="button"
                onClick={() => setStep('identity')}
                className="min-h-[44px] rounded-xl bg-[#F1EFEA] px-4 py-2 text-sm font-semibold text-[#202020]"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleEnterAsGuest}
                className="min-h-[44px] rounded-xl border border-[#E9E5D9] bg-white px-4 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
              >
                Entrar sin cuenta (modo prueba)
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
