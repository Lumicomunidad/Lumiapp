import { requestGeminiTts } from './api';

let activeAudioElement: HTMLAudioElement | null = null;
let lastSpoken = '';

export function getLastSpokenText(): string {
  return lastSpoken;
}

export function stopAllSpeech(): void {
  if (sentenceQueueTimer) {
    window.clearTimeout(sentenceQueueTimer);
    sentenceQueueTimer = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (activeAudioElement) {
    activeAudioElement.pause();
    activeAudioElement.currentTime = 0;
    activeAudioElement = null;
  }
}

export type VoiceGender = 'mujer' | 'hombre';

const FEMALE_HINTS = [
  'female', 'mujer', 'femenin', 'catalina', 'dalia', 'paloma', 'elena', 'laura', 'sabina',
  'paulina', 'monica', 'lucia', 'helena', 'conchita', 'ximena', 'sofia', 'salome',
  'camila', 'valeria', 'isabela', 'andrea', 'veronica', 'elvira', 'tania', 'lupe',
  'penelope', 'mia', 'marisol', 'estrella', 'esmeralda', 'esperanza',
  'x-eef', 'x-sfb',
];
const MALE_HINTS = [
  'male', 'hombre', 'masculin', 'lorenzo', 'alvaro', 'jorge', 'pablo', 'raul', 'diego',
  'tomas', 'enrique', 'carlos', 'miguel', 'andres', 'sebastian', 'gonzalo',
  'mateo', 'alonso', 'sergio', 'luciano', 'gerardo', 'emilio', 'rodrigo', 'pedro',
  'juan', 'manuel', 'antonio', 'x-eed', 'x-eec', 'x-esc',
];

let cachedVoices: SpeechSynthesisVoice[] = [];
let sentenceQueueTimer: number | null = null;

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoices = window.speechSynthesis.getVoices();
  });
}

function normalizeVoiceName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function pickVoiceByGender(
  gender?: VoiceGender
): { voice: SpeechSynthesisVoice | null; matchedGender: boolean } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { voice: null, matchedGender: false };
  }
  const latest = window.speechSynthesis.getVoices();
  const voices = latest.length > 0 ? latest : cachedVoices;
  const esVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  const pool = esVoices.length > 0 ? esVoices : voices;
  if (pool.length === 0) return { voice: null, matchedGender: false };

  const targetHints = gender === 'hombre' ? MALE_HINTS : FEMALE_HINTS;
  const oppositeHints = gender === 'hombre' ? FEMALE_HINTS : MALE_HINTS;

  let bestVoice: SpeechSynthesisVoice | null = null;
  let bestScore = -9999;
  let bestMatchedGender = false;

  for (const v of pool) {
    const name = normalizeVoiceName(v.name);
    let score = 0;

    // Priorizar voces naturales/neuronales/online
    if (name.includes('natural') || name.includes('neural') || name.includes('online')) {
      score += 140;
    } else if (name.includes('google')) {
      // Google español por defecto suele ser femenina; no dejar que tape una voz masculina real
      score += gender === 'hombre' ? 40 : 100;
    }

    if (v.lang.toLowerCase().includes('cl') || v.lang.toLowerCase().includes('419')) {
      score += 15;
    }

    const isTarget = gender ? targetHints.some((h) => name.includes(h)) : false;
    const isOpposite = gender ? oppositeHints.some((h) => name.includes(h)) : false;

    // El género solicitado siempre manda por encima del proveedor
    if (isTarget) score += 240;
    if (isOpposite) score -= 320;

    if (score > bestScore) {
      bestScore = score;
      bestVoice = v;
      bestMatchedGender = isTarget;
    }
  }

  return { voice: bestVoice ?? pool[0], matchedGender: bestMatchedGender };
}

export function getSpanishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const latest = window.speechSynthesis.getVoices();
  const voices = latest.length > 0 ? latest : cachedVoices;
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  return es.length > 0 ? es : voices;
}

export function getActiveVoiceLabel(gender?: VoiceGender, preferredVoiceName?: string): string {
  if (preferredVoiceName) return preferredVoiceName;
  const { voice } = pickVoiceByGender(gender);
  return voice ? voice.name : 'Voz del dispositivo';
}

export function speakBrowser(
  text: string,
  options?: {
    rate?: number;
    voiceGender?: VoiceGender;
    preferredVoiceName?: string;
    onEnd?: () => void;
  }
): void {
  if (!text.trim()) return;
  lastSpoken = text;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onEnd?.();
    return;
  }
  if (sentenceQueueTimer) {
    window.clearTimeout(sentenceQueueTimer);
    sentenceQueueTimer = null;
  }
  window.speechSynthesis.cancel();

  const picked = pickVoiceByGender(options?.voiceGender);
  const customVoice = options?.preferredVoiceName
    ? getSpanishVoices().find((v) => v.name === options.preferredVoiceName) ?? null
    : null;
  const voice = customVoice ?? picked.voice;
  const matchedGender = customVoice ? false : picked.matchedGender;

  const baseRate = options?.rate ?? 0.96;
  // Evitar pitch extremos (0.72 / 1.22) que vuelven metálica y robótica la síntesis
  const pitch =
    options?.voiceGender === 'hombre'
      ? matchedGender
        ? 0.97
        : 0.9
      : options?.voiceGender === 'mujer'
        ? matchedGender
          ? 1.03
          : 1.07
        : 1;
  const effectiveRate =
    options?.voiceGender === 'hombre' && !matchedGender ? Math.max(0.82, baseRate * 0.96) : baseRate;

  // Agrupar oraciones en bloques (~260 caracteres) para mantener fluidez natural sin pausas robóticas por cada punto
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buffer = '';
  for (const s of rawSentences) {
    if (buffer && buffer.length + s.length + 1 > 260) {
      chunks.push(buffer);
      buffer = s;
    } else {
      buffer = buffer ? `${buffer} ${s}` : s;
    }
  }
  if (buffer) chunks.push(buffer);

  if (chunks.length <= 1) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || 'es-CL';
    utterance.rate = effectiveRate;
    utterance.pitch = pitch;
    if (voice) utterance.voice = voice;
    if (options?.onEnd) utterance.onend = options.onEnd;
    window.speechSynthesis.speak(utterance);
    return;
  }

  let idx = 0;
  const speakNext = () => {
    if (idx >= chunks.length) {
      options?.onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[idx]);
    utterance.lang = voice?.lang || 'es-CL';
    utterance.rate = effectiveRate;
    utterance.pitch = pitch;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      idx += 1;
      if (idx >= chunks.length) {
        options?.onEnd?.();
      } else {
        sentenceQueueTimer = window.setTimeout(speakNext, 90);
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  speakNext();
}

export async function speakWithBestVoice(
  text: string,
  options?: {
    preferGemini?: boolean;
    rate?: number;
    voiceGender?: VoiceGender;
    preferredVoiceName?: string;
    style?: string;
    onEnd?: () => void;
    onFallback?: () => void;
  }
): Promise<'gemini' | 'browser'> {
  if (!text.trim()) return 'browser';
  stopAllSpeech();
  lastSpoken = text;

  if (options?.preferGemini) {
    try {
      const base64Audio = await requestGeminiTts(text, options.style, options.voiceGender);
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audio.playbackRate = options?.rate ?? 0.96;
      activeAudioElement = audio;
      audio.onended = () => {
        activeAudioElement = null;
        options?.onEnd?.();
      };
      await audio.play();
      return 'gemini';
    } catch {
      options?.onFallback?.();
    }
  }

  speakBrowser(text, {
    rate: options?.rate,
    voiceGender: options?.voiceGender,
    preferredVoiceName: options?.preferredVoiceName,
    onEnd: options?.onEnd,
  });
  return 'browser';
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function startSingleSpeechCapture(callbacks: {
  onResult: (transcript: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}): (() => void) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) {
    callbacks.onError('Este navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
    return null;
  }
  const recognizer = new Ctor();
  recognizer.lang = 'es-CL';
  recognizer.continuous = false;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  recognizer.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim() ?? '';
    if (transcript) callbacks.onResult(transcript);
  };
  recognizer.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      callbacks.onError('Permiso de micrófono denegado en el navegador.');
    } else {
      callbacks.onError('No se pudo escuchar con claridad. Intenta de nuevo.');
    }
  };
  recognizer.onend = () => {
    callbacks.onEnd?.();
  };

  try {
    recognizer.start();
    return () => {
      try {
        recognizer.stop();
      } catch {
        // Ignore stop errors
      }
    };
  } catch {
    callbacks.onError('No se pudo iniciar el micrófono.');
    return null;
  }
}

/**
 * Escucha continua de comandos de voz que no se cierra tras un comando.
 * Se reinicia automáticamente si el navegador finaliza la sesión por silencio.
 */
export function startContinuousVoiceCommandListener(callbacks: {
  onResult: (transcript: string) => void;
  onError: (message: string, fatal?: boolean) => void;
}): (() => void) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) {
    callbacks.onError('El navegador no soporta reconocimiento de voz. Usa Chrome o Edge.', true);
    return null;
  }

  let stoppedManually = false;
  let recognizer: BrowserSpeechRecognition | null = null;
  let restartTimer: number | null = null;

  const startSession = () => {
    if (stoppedManually) return;
    const instance = new Ctor();
    instance.lang = 'es-CL';
    instance.continuous = true;
    instance.interimResults = false;
    instance.maxAlternatives = 1;

    instance.onresult = (event) => {
      const results = event.results;
      const lastIdx = results.length - 1;
      const transcript = results[lastIdx]?.[0]?.transcript?.trim() ?? '';
      if (transcript) {
        callbacks.onResult(transcript);
      }
    };

    instance.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stoppedManually = true;
        callbacks.onError(
          'Permiso de micrófono bloqueado. Actívalo en la configuración del navegador para usar comandos por voz.',
          true
        );
      }
    };

    instance.onend = () => {
      if (!stoppedManually) {
        restartTimer = window.setTimeout(startSession, 350);
      }
    };

    recognizer = instance;
    try {
      instance.start();
    } catch {
      // Ignore if already started
    }
  };

  startSession();

  return () => {
    stoppedManually = true;
    if (restartTimer) window.clearTimeout(restartTimer);
    try {
      recognizer?.stop();
    } catch {
      // Ignore
    }
  };
}
