import type {
  AccessibilityMode,
  AppSectionId,
  CubeButtonSpec,
  CubeFaceSpec,
  SignEntry,
  SignPhraseStep,
  TransformedMessagePayload,
  TranslationResult,
  TranslationTarget,
} from '../types/lumi';

export const MODE_METADATA: Record<
  AccessibilityMode,
  {
    label: string;
    shortLabel: string;
    summary: string;
    guidance: string;
  }
> = {
  ciego: {
    label: 'CIEGO',
    shortLabel: 'Audio y voz',
    summary: 'Modo principalmente por audio',
    guidance:
      'Lumi puede leer las opciones en voz alta y escuchar tus comandos. No necesitas escribir para navegar.',
  },
  mudo: {
    label: 'MUDO',
    shortLabel: 'Visual y escrito',
    summary: 'Modo visual y escrito',
    guidance:
      'Puedes comunicarte escribiendo, usando frases rápidas o apoyos visuales, y reproducir tus mensajes con voz Lumi.',
  },
  sordo: {
    label: 'SORDO',
    shortLabel: 'Visual y señas',
    summary: 'Modo visual, escrito y lengua de señas',
    guidance:
      'Toda la navegación es visual y escrita, con transcripción clara, lengua de señas y dictado opcional si lo deseas.',
  },
  general: {
    label: 'NINGUNA DE ELLAS',
    shortLabel: 'Modo general',
    summary: 'Modo general multimodal',
    guidance:
      'Combina voz, lectura fácil, lengua de señas, asistente inteligente y audiolibros a tu ritmo.',
  },
};

export const IDENTITY_OPTIONS = [
  'Hombre',
  'Mujer',
  'Transexual',
  'No binario',
  'Queer',
  'Prefiero no decirlo',
] as const;

export const CUBE_FACES: CubeFaceSpec[] = [
  {
    id: 'frontal',
    name: 'Cara Frontal',
    primaryFunction: 'Salida de audio + IA / Encendido y Apagado',
    description:
      'Aloja el altavoz frontal de alta claridad, el botón central del micrófono para hablar con Lumi y el indicador LED de estado.',
    controls: ['Botón 1: Encendido / Menú principal', 'Micrófono directo con Lumi IA'],
  },
  {
    id: 'superior',
    name: 'Cara Superior',
    brailleDots: [2, 2],
    primaryFunction: 'Idea / Grabar y Detener',
    description:
      'Botones táctiles con puntos Braille en relieve para capturar una nota de voz rápida, dictar un mensaje o detener una acción.',
    controls: ['Botón 2: Grabar audio o idea', 'Botón 5: Detener grabación o lectura'],
  },
  {
    id: 'trasera',
    name: 'Cara Trasera',
    brailleDots: [3, 2],
    primaryFunction: 'Reproducir y Pausar',
    description:
      'Superficie ergonómica posterior con marcaje Braille de 3 y 2 puntos para controlar audiolibros, audios recibidos y lectura de pantalla.',
    controls: ['Botón 3: Reproducir', 'Botón 4: Pausar'],
  },
  {
    id: 'izquierda',
    name: 'Cara Izquierda',
    primaryFunction: 'Anterior y Siguiente',
    description:
      'Botones direccionales amplios de alto contraste para moverse por menús, capítulos de audiolibros o mensajes sin mirar la pantalla.',
    controls: ['Botón 6: Anterior', 'Botón 7: Siguiente'],
  },
  {
    id: 'derecha',
    name: 'Cara Derecha',
    primaryFunction: 'Confirmar y Cancelar / Volver',
    description:
      'Acciones binarias firmes con iconos táctiles de verificación y cierre para confirmar pagos NFC, envíos o regresar al menú.',
    controls: ['Botón 8: Confirmar', 'Botón 9: Cancelar / Volver'],
  },
  {
    id: 'inferior',
    name: 'Cara Inferior',
    primaryFunction: 'Ecosistema de aplicaciones integradas',
    description:
      'Acceso directo por voz y tacto a mensajería, audios sociales, calendario, calculadora parlante, música, audiolibros y compras por voz.',
    controls: [
      'WhatsApp y Mensajes Lumi',
      'Insta Audios y Red social',
      'Calendario y Calculadora accesible',
      'Spotify, Audiolibros y Compras por voz',
    ],
  },
];

export const CUBE_BUTTONS: CubeButtonSpec[] = [
  {
    number: 1,
    label: 'Encendido / Menú',
    shortSymbol: '⏻',
    action: 'power_menu',
    description: 'Vuelve al menú principal de Lumi',
  },
  {
    number: 2,
    label: 'Grabar',
    shortSymbol: '●',
    action: 'record',
    description: 'Inicia dictado o comando por voz',
  },
  {
    number: 3,
    label: 'Reproducir',
    shortSymbol: '▶',
    action: 'play',
    description: 'Lee en voz alta el contenido actual',
  },
  {
    number: 4,
    label: 'Pausar',
    shortSymbol: '❚❚',
    action: 'pause',
    description: 'Pausa la reproducción de audio',
  },
  {
    number: 5,
    label: 'Detener',
    shortSymbol: '■',
    action: 'stop',
    description: 'Detiene lectura y micrófono',
  },
  {
    number: 6,
    label: 'Anterior',
    shortSymbol: '◀',
    action: 'prev',
    description: 'Elemento o capítulo anterior',
  },
  {
    number: 7,
    label: 'Siguiente',
    shortSymbol: '▶',
    action: 'next',
    description: 'Siguiente elemento o capítulo',
  },
  {
    number: 8,
    label: 'Confirmar',
    shortSymbol: '✓',
    action: 'confirm',
    description: 'Confirma la acción seleccionada',
  },
  {
    number: 9,
    label: 'Cancelar',
    shortSymbol: '✕',
    action: 'cancel',
    description: 'Cancela o vuelve atrás',
  },
];

export const SIGN_DICTIONARY: SignEntry[] = [
  {
    id: 'hola',
    word: 'Hola',
    category: 'saludos',
    handshape: 'Palma abierta con dedos juntos',
    location: 'A la altura de la sien o frente lateral',
    movement: 'Separa la mano suavemente hacia afuera con un gesto amable',
    expression: 'Sonrisa cálida y contacto visual directo',
    gestureIcon: '👋',
  },
  {
    id: 'gracias',
    word: 'Gracias',
    category: 'saludos',
    handshape: 'Mano plana, dedos extendidos',
    location: 'Punta de los dedos rozando suavemente el mentón',
    movement: 'Lleva la mano hacia adelante y abajo en dirección a la otra persona',
    expression: 'Asentimiento ligero y gesto agradecido',
    gestureIcon: '🤲',
  },
  {
    id: 'por_favor',
    word: 'Por favor',
    category: 'saludos',
    handshape: 'Palma abierta apoyada en el pecho',
    location: 'Centro del pecho',
    movement: 'Realiza un movimiento circular suave en sentido horario',
    expression: 'Expresión amable y atenta',
    gestureIcon: '🙏',
  },
  {
    id: 'ayuda',
    word: 'Ayuda',
    category: 'emergencia',
    handshape: 'Mano de apoyo plana debajo de la otra mano con pulgar arriba',
    location: 'Frente al torso',
    movement: 'Eleva ambas manos juntas hacia arriba con firmeza',
    expression: 'Cejas levemente elevadas si estás pidiendo asistencia',
    gestureIcon: '🆘',
  },
  {
    id: 'lumi',
    word: 'Lumi / Luz',
    category: 'lumi',
    handshape: 'Puño cerrado que se abre en abanico',
    location: 'Frente al pecho o ligeramente arriba',
    movement: 'Abre los cinco dedos proyectando luz hacia afuera',
    expression: 'Rostro despejado e iluminado',
    gestureIcon: '☀️',
  },
  {
    id: 'escuchar',
    word: 'Escuchar / Audio',
    category: 'lumi',
    handshape: 'Mano curvada en forma de C detrás o cerca de la oreja',
    location: 'Junto al oído',
    movement: 'Acerca suavemente la mano hacia adelante indicando atención',
    expression: 'Inclinación leve de atención',
    gestureIcon: '👂',
  },
  {
    id: 'familia',
    word: 'Familia',
    category: 'cotidiano',
    handshape: 'Ambas manos formando un círculo abierto con índice y pulgar',
    location: 'Delante del pecho',
    movement: 'Dibuja un círculo completo uniendo las manos al frente',
    expression: 'Expresión cercana y afectuosa',
    gestureIcon: '🏡',
  },
  {
    id: 'leer',
    word: 'Leer / Libro',
    category: 'cotidiano',
    handshape: 'Palmas juntas que se abren como páginas',
    location: 'Frente al pecho',
    movement: 'Abre las dos manos hacia los lados manteniendo los meñiques juntos',
    expression: 'Mirada dirigida hacia las palmas abiertas',
    gestureIcon: '📖',
  },
  {
    id: 'si',
    word: 'Sí / Confirmar',
    category: 'cotidiano',
    handshape: 'Puño cerrado',
    location: 'A la altura del hombro',
    movement: 'Inclina la muñeca arriba y abajo imitando asentir con la cabeza',
    expression: 'Asentimiento claro con la cabeza',
    gestureIcon: '👍',
  },
  {
    id: 'no',
    word: 'No / Cancelar',
    category: 'cotidiano',
    handshape: 'Índice y medio unidos al pulgar en pinza',
    location: 'Frente al rostro lateral',
    movement: 'Cierra los dedos contra el pulgar una o dos veces con claridad',
    expression: 'Negación suave con la cabeza',
    gestureIcon: '✋',
  },
  {
    id: 'medico',
    word: 'Médico / Salud',
    category: 'emergencia',
    handshape: 'Dedos índice y medio juntos',
    location: 'Sobre la muñeca contraria (zona del pulso)',
    movement: 'Toca suavemente dos veces la muñeca como tomando el pulso',
    expression: 'Seria o informativa según la urgencia',
    gestureIcon: '🩺',
  },
  {
    id: 'agua',
    word: 'Agua',
    category: 'cotidiano',
    handshape: 'Tres dedos extendidos (índice, medio, anular)',
    location: 'Cerca del mentón o labios',
    movement: 'Toca suavemente el mentón dos veces',
    expression: 'Neutral o de solicitud',
    gestureIcon: '💧',
  },
];

export function normalizeVoice(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getPersonalGreeting(identity: string, name?: string): string {
  const trimmedName = (name ?? '').trim();
  let prefix = 'Hola, qué alegría tenerte aquí';
  if (identity === 'Hombre') prefix = 'Hola amigo';
  else if (identity === 'Mujer') prefix = 'Hola amiga';
  return trimmedName ? `${prefix}, ${trimmedName}` : prefix;
}

export function matchModeFromSpeech(transcript: string): AccessibilityMode | null {
  const normalized = normalizeVoice(transcript);
  if (!normalized) return null;
  if (normalized.includes('ciego') || normalized.includes('ciega')) return 'ciego';
  if (normalized.includes('mudo') || normalized.includes('muda')) return 'mudo';
  if (normalized.includes('sordo') || normalized.includes('sorda')) return 'sordo';
  if (normalized.includes('ninguna') || normalized.includes('general')) return 'general';
  return null;
}

export function matchIdentityFromSpeech(transcript: string): string | null {
  const normalized = normalizeVoice(transcript);
  if (!normalized) return null;
  if (normalized.includes('omitir') || normalized.includes('saltar')) return 'omitir';
  if (normalized.includes('no binario')) return 'No binario';
  if (normalized.includes('transexual') || normalized.includes('trans')) return 'Transexual';
  if (normalized.includes('queer')) return 'Queer';
  if (normalized.includes('prefiero no decirlo') || normalized.includes('no quiero decir')) {
    return 'Prefiero no decirlo';
  }
  if (normalized.includes('hombre')) return 'Hombre';
  if (normalized.includes('mujer')) return 'Mujer';
  return null;
}

export type VoiceCommandResult =
  | { type: 'navigate'; section: AppSectionId }
  | { type: 'stop_speaking' }
  | { type: 'disable_voice' }
  | { type: 'enable_voice' }
  | { type: 'repeat' }
  | { type: 'help' }
  | { type: 'unknown' };

export function matchVoiceCommand(transcript: string): VoiceCommandResult {
  const text = normalizeVoice(transcript);
  if (!text) return { type: 'unknown' };
  if (
    text.includes('desactivar voz') ||
    text.includes('desactivar comando') ||
    text.includes('apagar voz') ||
    text.includes('apagar microfono') ||
    text.includes('cerrar voz') ||
    text.includes('desactivar microfono')
  ) {
    return { type: 'disable_voice' };
  }
  if (text.includes('activar voz') || text.includes('encender microfono')) {
    return { type: 'enable_voice' };
  }
  if (
    text.includes('detener lectura') ||
    text.includes('silencio') ||
    text === 'detener' ||
    text === 'callar'
  ) {
    return { type: 'stop_speaking' };
  }
  if (text.includes('repetir')) return { type: 'repeat' };
  if (text.includes('ayuda')) return { type: 'help' };
  if (text.includes('menu') || text.includes('inicio') || text.includes('volver')) {
    return { type: 'navigate', section: 'home' };
  }

  const routes: Array<[string[], AppSectionId]> = [
    [['mensajes', 'mensaje', 'sala', 'llamada'], 'mensajes'],
    [['red social', 'social', 'comunidad'], 'social'],
    [['traductor', 'traducir'], 'traductor'],
    [['lengua de senas', 'senas', 'sena'], 'senas'],
    [['calendario', 'recordatorio', 'recordatorios', 'agenda', 'hora'], 'calendario'],
    [['certificado', 'certificados', 'discapacidad', 'gobierno', 'beneficio', 'beneficios'], 'certificados'],
    [['asistente', 'lumi'], 'asistente'],
    [['audiolibros', 'audiolibro', 'libro', 'libros'], 'audiolibros'],
    [['lumicube', 'cubo', 'control'], 'lumicube'],
  ];

  for (const [keywords, section] of routes) {
    if (keywords.some((kw) => text.includes(kw))) {
      return { type: 'navigate', section };
    }
  }
  return { type: 'unknown' };
}

export function validateAccountInput(input: {
  name?: string;
  email: string;
  password: string;
  isRegister: boolean;
}): { valid: boolean; error?: string } {
  const email = input.email.trim();
  const password = input.password;
  if (input.isRegister) {
    const name = (input.name ?? '').trim();
    if (name.length < 2) {
      return { valid: false, error: 'Escribe un nombre de al menos 2 caracteres.' };
    }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Ingresa un correo electrónico válido.' };
  }
  if (!password || password.length < 6) {
    return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  return { valid: true };
}

export function validateNonEmptyText(text: string, minLength = 1, maxLength = 800): string | null {
  const trimmed = text.trim();
  if (trimmed.length < minLength) {
    return 'Escribe o dicta un texto antes de continuar.';
  }
  if (trimmed.length > maxLength) {
    return `El texto supera el límite de ${maxLength} caracteres.`;
  }
  return null;
}

export function decomposePhraseToSigns(phrase: string): SignPhraseStep[] {
  const normalized = normalizeVoice(phrase);
  if (!normalized) return [];
  const words = normalized
    .replace(/[.,!?¿¡;:()"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'a', 'en', 'y', 'que']);
  const meaningful = words.filter((w) => !stopWords.has(w));
  const tokens = meaningful.length > 0 ? meaningful : words;

  return tokens.map((token) => {
    const match = SIGN_DICTIONARY.find((entry) => {
      const normalizedWord = normalizeVoice(entry.word);
      return (
        normalizedWord === token ||
        normalizedWord.split('/').some((part) => part.trim() === token)
      );
    });
    if (match) {
      return {
        token,
        gloss: match.word.toUpperCase(),
        cue: `${match.handshape}. ${match.movement}`,
      };
    }
    return {
      token,
      gloss: token.toUpperCase(),
      cue: `Deletrea "${token}" en dactilología o usa gesto contextual claro.`,
    };
  });
}

export function buildLocalAccessibleTranslation(
  sourceText: string,
  target: TranslationTarget
): TranslationResult {
  const clean = sourceText.trim();
  const signSteps = decomposePhraseToSigns(clean);

  if (target === 'lectura_facil') {
    const sentences = clean
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const shortLines = sentences.length > 0 ? sentences : [clean];
    return {
      target,
      headline: 'Versión en Lectura Fácil',
      adaptedText: shortLines.map((line) => `• ${line}.`).join('\n'),
      steps: [
        'Usa frases cortas y directas.',
        'Una idea principal por línea.',
        'Evita palabras técnicas difíciles.',
      ],
      pictograms: signSteps.slice(0, 4).map((s) => ({
        symbol: '💬',
        label: s.gloss,
      })),
      source: 'local',
    };
  }

  if (target === 'senas_glosa') {
    return {
      target,
      headline: 'Estructura en Glosa de Lengua de Señas',
      adaptedText: signSteps.map((s) => s.gloss).join(' · ') || clean.toUpperCase(),
      steps: signSteps.map((s) => `${s.gloss}: ${s.cue}`),
      pictograms: signSteps.slice(0, 5).map((s) => ({
        symbol: '🤟',
        label: s.gloss,
      })),
      source: 'local',
    };
  }

  if (target === 'pictogramas') {
    const pictos = signSteps.slice(0, 6).map((s) => {
      const entry = SIGN_DICTIONARY.find((d) =>
        normalizeVoice(d.word).includes(normalizeVoice(s.token))
      );
      return {
        symbol: entry?.gestureIcon ?? '🟨',
        label: s.gloss,
      };
    });
    return {
      target,
      headline: 'Secuencia de Pictogramas Accesibles',
      adaptedText: pictos.map((p) => `${p.symbol} ${p.label}`).join('  →  '),
      steps: ['Lee de izquierda a derecha cada concepto clave.', 'Puedes tocar "Escuchar" para oír la frase completa.'],
      pictograms: pictos,
      source: 'local',
    };
  }

  return {
    target,
    headline: target === 'en' ? 'Traducción al Inglés (modo sin conexión IA)' : 'Traducción al Portugués (modo sin conexión IA)',
    adaptedText: clean,
    steps: ['Conecta una clave de Gemini activa para traducción idiomática automática completa.'],
    pictograms: [{ symbol: '🌐', label: target.toUpperCase() }],
    source: 'local',
  };
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function computeBookProgressPercent(
  chapterIndex: number,
  totalChapters: number,
  chapterPositionPercent: number
): number {
  if (totalChapters <= 0) return 0;
  const clampedChapter = Math.min(Math.max(0, chapterIndex), totalChapters - 1);
  const clampedInner = Math.min(Math.max(0, chapterPositionPercent), 100);
  const overall = ((clampedChapter + clampedInner / 100) / totalChapters) * 100;
  return Math.round(overall);
}

export function expandCommonAbbreviations(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\bxfa\b/gi, 'por favor'],
    [/\bporfa\b/gi, 'por favor'],
    [/\bxq\b/gi, 'porque'],
    [/\bpq\b/gi, 'porque'],
    [/\btb\b/gi, 'también'],
    [/\bmsj\b/gi, 'mensaje'],
    [/\binfo\b/gi, 'información'],
    [/\bq\b/gi, 'que'],
    [/\bd\b/gi, 'de'],
    [/\bhrs\b/gi, 'horas'],
  ];
  let expanded = text.trim();
  for (const [pattern, replacement] of replacements) {
    expanded = expanded.replace(pattern, replacement);
  }
  return expanded;
}

function buildContextualPictograms(text: string): Array<{ symbol: string; label: string }> {
  const norm = normalizeVoice(text);
  const cues: Array<{ keywords: string[]; symbol: string; label: string }> = [
    { keywords: ['hola', 'buenos dias', 'buenas tardes', 'saludo'], symbol: '👋', label: 'Saludo' },
    { keywords: ['gracias', 'agradezco'], symbol: '🙏', label: 'Gracias' },
    { keywords: ['ayuda', 'auxilio', 'apoyo', 'socorro'], symbol: '🆘', label: 'Ayuda' },
    { keywords: ['casa', 'hogar', 'familia'], symbol: '🏡', label: 'Casa / Familia' },
    { keywords: ['metro', 'bus', 'estacion', 'calle', 'llegue', 'camino'], symbol: '🚇', label: 'Traslado' },
    { keywords: ['agua', 'cafe', 'comer', 'almuerzo'], symbol: '💧', label: 'Bebida / Comida' },
    { keywords: ['medico', 'doctor', 'salud', 'hospital', 'dolor'], symbol: '🩺', label: 'Salud' },
    { keywords: ['si', 'listo', 'bien', 'confirmado', 'ok'], symbol: '✓', label: 'Confirmado' },
    { keywords: ['no', 'cancelar', 'espera'], symbol: '✕', label: 'No / Espera' },
  ];

  const found: Array<{ symbol: string; label: string }> = [];
  for (const cue of cues) {
    if (cue.keywords.some((kw) => norm.includes(kw))) {
      found.push({ symbol: cue.symbol, label: cue.label });
    }
  }
  if (found.length > 0) return found.slice(0, 5);

  return decomposePhraseToSigns(text)
    .slice(0, 4)
    .map((step) => ({
      symbol: '💬',
      label: step.gloss,
    }));
}

export function transformMessageForRecipient(
  rawText: string,
  senderMode: AccessibilityMode,
  recipientMode: AccessibilityMode
): TransformedMessagePayload {
  const expanded = expandCommonAbbreviations(rawText);
  const clean = expanded || 'Mensaje vacío';
  const signGloss = decomposePhraseToSigns(clean);
  const pictograms = buildContextualPictograms(clean);

  if (recipientMode === 'ciego') {
    const ended = /[.!?]$/.test(clean) ? clean : `${clean}.`;
    return {
      recipientMode,
      modeLabel: 'Adaptado para receptor ciego (Audio y LumiCube)',
      adaptedHeadline: 'Guion claro para lectura por voz',
      adaptedText: ended,
      audioScript: `Mensaje recibido: ${ended}`,
      signGloss: [],
      pictograms: [],
      tactileCue: 'LumiCube: Pulsa Botón 3 (Cara Trasera) para escuchar o Botón 2 para responder por voz.',
      suggestedReplies: ['Recibido, muchas gracias', 'Te respondo por voz ahora', '¿Puedes darme más detalles?'],
      source: 'local',
    };
  }

  if (recipientMode === 'sordo') {
    const clauses = clean
      .split(/[,.;!?]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    const easyLines = clauses.length > 0 ? clauses.map((c) => `• ${c}.`).join('\n') : `• ${clean}`;
    return {
      recipientMode,
      modeLabel: 'Adaptado para receptor sordo (Visual, Glosa y Señas)',
      adaptedHeadline: 'Texto directo + Lengua de señas',
      adaptedText: easyLines,
      audioScript: clean,
      signGloss,
      pictograms,
      tactileCue: 'Aviso visual claro en pantalla (sin alerta sonora obligatoria).',
      suggestedReplies: ['Entendido, gracias', 'Estoy en camino', '¿Puedes explicarlo más simple?'],
      source: 'local',
    };
  }

  if (recipientMode === 'mudo') {
    return {
      recipientMode,
      modeLabel: 'Adaptado para receptor mudo (Lectura y respuesta hablada de un toque)',
      adaptedHeadline: 'Mensaje claro con respuestas rápidas por voz',
      adaptedText: clean,
      audioScript: clean,
      signGloss: signGloss.slice(0, 4),
      pictograms,
      tactileCue: 'LumiCube: Botón 8 (Confirmar) reproduce en voz tu respuesta seleccionada.',
      suggestedReplies: [
        'Sí, estoy de acuerdo.',
        'Un momento por favor.',
        'Gracias, ya lo reviso.',
        'Necesito ayuda con esto.',
      ],
      source: 'local',
    };
  }

  const originNote =
    senderMode === 'ciego'
      ? 'Dictado por voz y estructurado por Lumi'
      : senderMode === 'mudo'
        ? 'Escrito con apoyo Lumi'
        : senderMode === 'sordo'
          ? 'Enviado en modo visual'
          : 'Comunicación multimodal';

  return {
    recipientMode,
    modeLabel: `Adaptado para receptor general (${originNote})`,
    adaptedHeadline: 'Mensaje claro en texto y audio',
    adaptedText: clean,
    audioScript: clean,
    signGloss: signGloss.slice(0, 4),
    pictograms,
    tactileCue: 'Disponible para lectura visual, audio y control LumiCube.',
    suggestedReplies: ['¡Gracias!', 'Recibido perfectamente', 'Hablamos pronto'],
    source: 'local',
  };
}

/**
 * Genera respuestas rápidas contextuales para personas en modo mudo durante una sala o llamada.
 */
export function buildMuteQuickReplies(lastSpokenText: string): string[] {
  const norm = normalizeVoice(lastSpokenText);
  if (!norm) {
    return [
      'Hola, estoy escuchando.',
      'Sí, entiendo.',
      'Un momento, estoy escribiendo.',
      '¿Puedes repetir más despacio?',
    ];
  }
  if (norm.includes('como estas') || norm.includes('como te sientes')) {
    return [
      'Estoy bien, gracias.',
      'Un poco cansado, pero bien.',
      'Necesito ayuda con algo.',
      '¿Y tú cómo estás?',
    ];
  }
  if (norm.includes('donde') || norm.includes('llegar') || norm.includes('camino')) {
    return [
      'Estoy en camino.',
      'Ya llegué bien.',
      'Te envío mi ubicación en un momento.',
      'Estoy en casa.',
    ];
  }
  if (norm.includes('ayuda') || norm.includes('necesitas') || norm.includes('quieres')) {
    return [
      'Sí, por favor.',
      'No, muchas gracias.',
      'Necesito un momento para responder.',
      'Prefiero que me lo escribas.',
    ];
  }
  return [
    'Sí, de acuerdo.',
    'No, gracias.',
    'Un momento, estoy escribiendo mi respuesta.',
    '¿Puedes repetirlo más claro?',
  ];
}

/**
 * Detecta si el usuario dijo "colgar" para terminar la llamada.
 */
export function isHangupVoiceCommand(transcript: string): boolean {
  const norm = normalizeVoice(transcript);
  return (
    norm.includes('colgar') ||
    norm.includes('terminar llamada') ||
    norm.includes('finalizar llamada') ||
    norm.includes('cortar llamada')
  );
}

/**
 * Extrae el código de sala si el usuario dice "unirse a sala LUMI 942" o "sala 500".
 */
export function extractRoomCodeFromSpeech(transcript: string): string | null {
  const norm = normalizeVoice(transcript);
  const match = norm.match(/(?:unirse a sala|unirme a sala|ir a sala|cambiar a sala|sala)\s+([a-z0-9\s-]{2,20})/i);
  if (!match) return null;
  const rawCode = match[1]
    .trim()
    .replace(/\s+/g, '-')
    .toUpperCase();
  return rawCode || null;
}

/**
 * Convierte un correo dictado por voz en formato válido (ej. "dilan arroba gmail punto com" -> "dilan@gmail.com").
 */
export function parseSpokenEmail(transcript: string): string {
  return transcript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(arroba|at)\b/g, '@')
    .replace(/\b(punto|dot)\b/g, '.')
    .replace(/\b(guion bajo|guión bajo|underscore)\b/g, '_')
    .replace(/\b(guion|guión|menos|dash)\b/g, '-')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Limpia una contraseña dictada por voz eliminando espacios entre palabras/caracteres.
 */
export function parseSpokenPassword(transcript: string): string {
  return transcript.trim().replace(/\s+/g, '');
}

