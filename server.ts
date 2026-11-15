import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type {
  AccessibilityMode,
  Audiobook,
  AudiobookProgress,
  ChatMessage,
  ContactThread,
  LumiUser,
  SocialPost,
  TransformedMessagePayload,
  TranslationTarget,
} from './src/types/lumi.ts';

interface StoredUser extends LumiUser {
  passwordSalt: string;
  passwordHash: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

interface DatabaseState {
  users: StoredUser[];
  sessions: SessionRecord[];
  contactsByUser: Record<string, ContactThread[]>;
  messagesByUser: Record<string, ChatMessage[]>;
  posts: SocialPost[];
  likedPostsByUser: Record<string, string[]>;
  progressByUser: Record<string, Record<string, AudiobookProgress>>;
}

const PORT = Number(process.env.PORT ?? 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'lumi-db.json');

const SEED_CONTACTS: ContactThread[] = [
  {
    id: 'familia',
    name: 'Clara (Familia)',
    role: 'Contacto prioritario',
    preferredChannel: 'Multimodal (texto y audio)',
    recipientMode: 'general',
  },
  {
    id: 'diego',
    name: 'Diego (Modo Sordo)',
    role: 'Amigo · Comunicación visual',
    preferredChannel: 'Texto claro + Señas + Pictogramas',
    recipientMode: 'sordo',
  },
  {
    id: 'camila',
    name: 'Camila (Modo Ciego)',
    role: 'Amiga · Audio prioritario',
    preferredChannel: 'Narración por voz + LumiCube',
    recipientMode: 'ciego',
  },
  {
    id: 'sofia',
    name: 'Sofía (Modo Mudo)',
    role: 'Compañera · Respuesta rápida por voz',
    preferredChannel: 'Texto + Frases habladas',
    recipientMode: 'mudo',
  },
  {
    id: 'soporte',
    name: 'Equipo LumiCube',
    role: 'Asistencia técnica',
    preferredChannel: 'Lectura fácil',
    recipientMode: 'general',
  },
];

function buildServerTransformedPayload(
  rawText: string,
  recipientMode: AccessibilityMode
): TransformedMessagePayload {
  const clean = rawText
    .trim()
    .replace(/\bxfa\b/gi, 'por favor')
    .replace(/\bq\b/gi, 'que')
    .replace(/\btb\b/gi, 'también');

  const words = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?¿¡;:()"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'a', 'en', 'y', 'que'].includes(w));

  const signGloss = words.slice(0, 6).map((token) => ({
    token,
    gloss: token.toUpperCase(),
    cue: `Seña clara para "${token}" con expresión facial acorde.`,
  }));

  const pictograms = words.slice(0, 4).map((w) => ({
    symbol: w.includes('hola')
      ? '👋'
      : w.includes('gracias')
        ? '🙏'
        : w.includes('ayuda')
          ? '🆘'
          : w.includes('casa')
            ? '🏡'
            : '💬',
    label: w.toUpperCase(),
  }));

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
    return {
      recipientMode,
      modeLabel: 'Adaptado para receptor sordo (Visual, Glosa y Señas)',
      adaptedHeadline: 'Texto directo + Lengua de señas',
      adaptedText: clauses.length > 0 ? clauses.map((c) => `• ${c}.`).join('\n') : `• ${clean}`,
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

  return {
    recipientMode: 'general',
    modeLabel: 'Adaptado para receptor general (Texto y audio)',
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

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    contactId: 'familia',
    sender: 'contact',
    senderName: 'Clara (Familia)',
    text: 'Hola, ¿cómo vas hoy? Cuando llegues a casa me mandas un mensaje por Lumi.',
    modality: 'texto',
    transformed: buildServerTransformedPayload(
      'Hola, ¿cómo vas hoy? Cuando llegues a casa me mandas un mensaje por Lumi.',
      'general'
    ),
    createdAt: '2026-11-12T10:15:00.000Z',
  },
  {
    id: 'm2',
    contactId: 'diego',
    sender: 'contact',
    senderName: 'Diego (Modo Sordo)',
    text: 'Hola, estoy esperando cerca de la estación. Avísame cuando llegues.',
    modality: 'texto',
    transformed: buildServerTransformedPayload(
      'Hola, estoy esperando cerca de la estación. Avísame cuando llegues.',
      'sordo'
    ),
    createdAt: '2026-11-12T10:30:00.000Z',
  },
  {
    id: 'm3',
    contactId: 'camila',
    sender: 'contact',
    senderName: 'Camila (Modo Ciego)',
    text: 'Hola, te escucho desde LumiCube. ¿Nos vemos a las cinco?',
    modality: 'voz',
    transformed: buildServerTransformedPayload(
      'Hola, te escucho desde LumiCube. ¿Nos vemos a las cinco?',
      'ciego'
    ),
    createdAt: '2026-11-12T10:45:00.000Z',
  },
  {
    id: 'm4',
    contactId: 'sofia',
    sender: 'contact',
    senderName: 'Sofía (Modo Mudo)',
    text: 'Ya estoy en la entrada, dime si necesitas que te espere.',
    modality: 'frase_rapida',
    transformed: buildServerTransformedPayload(
      'Ya estoy en la entrada, dime si necesitas que te espere.',
      'mudo'
    ),
    createdAt: '2026-11-12T10:55:00.000Z',
  },
  {
    id: 'm5',
    contactId: 'soporte',
    sender: 'contact',
    senderName: 'Equipo LumiCube',
    text: 'Tu app Lumi está lista para vincularse con los 9 botones táctiles del futuro Teléfono Cubo.',
    modality: 'texto',
    transformed: buildServerTransformedPayload(
      'Tu app Lumi está lista para vincularse con los 9 botones táctiles del futuro Teléfono Cubo.',
      'general'
    ),
    createdAt: '2026-11-12T11:00:00.000Z',
  },
];

const SEED_POSTS: SocialPost[] = [
  {
    id: 'p1',
    authorId: 'seed-1',
    authorName: 'Camila R.',
    authorMode: 'ciego',
    category: 'audio',
    content:
      'Hoy probé la navegación por voz para abrir Audiolibros y me encantó poder detener la lectura solo diciendo silencio. ¡Muy cómodo para usar sin mirar la pantalla!',
    altDescription: 'Experiencia de navegación por voz en el modo Ciego',
    likes: 14,
    likedByUser: false,
    comments: [
      {
        id: 'c1',
        authorName: 'Tomás V.',
        text: 'A mí también me ayudó mucho combinarlo con los botones Anterior y Siguiente.',
        createdAt: '2026-11-12T09:30:00.000Z',
      },
    ],
    createdAt: '2026-11-12T09:10:00.000Z',
  },
  {
    id: 'p2',
    authorId: 'seed-2',
    authorName: 'Diego M.',
    authorMode: 'sordo',
    category: 'senas',
    content:
      'Comparto un consejo: en el módulo de Lengua de señas pueden escribir cualquier frase cotidiana y ver paso a paso cómo posicionar las manos y la expresión facial.',
    altDescription: 'Recomendación del diccionario y traductor visual de lengua de señas',
    likes: 19,
    likedByUser: false,
    comments: [],
    createdAt: '2026-11-12T08:45:00.000Z',
  },
  {
    id: 'p3',
    authorId: 'seed-3',
    authorName: 'Valentina S.',
    authorMode: 'mudo',
    category: 'comunidad',
    content:
      'Uso el modo Mudo en cafés y trámites: escribo mi pedido con frases rápidas y Lumi lo lee en voz alta con claridad. Me da mucha autonomía en el día a día.',
    altDescription: 'Uso de frases rápidas y voz Lumi en atención presencial',
    likes: 23,
    likedByUser: false,
    comments: [],
    createdAt: '2026-11-11T19:20:00.000Z',
  },
  {
    id: 'p4',
    authorId: 'seed-4',
    authorName: 'Equipo Lumi',
    authorMode: 'general',
    category: 'consejos',
    content:
      'El futuro LumiCube integra 6 caras accesibles: micrófono frontal con IA, puntos Braille para grabar y pausar, botones amplios para navegar y pagos NFC por voz.',
    altDescription: 'Resumen de las seis caras funcionales del Teléfono Cubo con Lumi',
    likes: 31,
    likedByUser: false,
    comments: [],
    createdAt: '2026-11-11T16:00:00.000Z',
  },
];

const AUDIOBOOKS_CATALOG: Audiobook[] = [
  {
    id: 'cubo-de-luz',
    title: 'El Cubo de Luz',
    author: 'Colección Lumi Narrativa',
    category: 'Ficción inclusiva',
    summary:
      'Tres relatos breves sobre cómo una pequeña herramienta táctil transforma la comunicación cotidiana entre vecinos, familias y viajeros.',
    coverAccent: '#F5DF91',
    chapters: [
      {
        id: 'cubo-cap-1',
        number: 1,
        title: 'La mañana sin prisas',
        durationSeconds: 75,
        text: 'Mateo apoyó la mano sobre la cara superior del pequeño cubo negro. Sintió los dos puntos en relieve bajo la yema del pulgar y presionó suavemente. Una voz serena y cálida llenó la habitación: Buenos días, Mateo. Tienes un mensaje de Clara y el cielo está despejado. Por primera vez en meses, no necesitó buscar cables ni deslizar vidrios resbaladizos para empezar su día.',
      },
      {
        id: 'cubo-cap-2',
        number: 2,
        title: 'El café de la esquina',
        durationSeconds: 82,
        text: 'En la cafetería del barrio, Sofía tocó el botón de confirmación luego de seleccionar su frase en pantalla. Lumi pronunció su pedido con tono amable mientras mostraba la tarjeta visual al barista. Ambos sonrieron al instante. La tecnología no había reemplazado la conversación; simplemente había quitado la barrera que antes la frenaba.',
      },
      {
        id: 'cubo-cap-3',
        number: 3,
        title: 'Seis caras, un mismo lenguaje',
        durationSeconds: 90,
        text: 'Al caer la tarde, cada persona en la plaza compartía historias a su manera: unos escuchando capítulos con auriculares, otros leyendo pictogramas luminosos y otros practicando señas frente a la mesa. Más independencia, más inclusión, pensó Mateo, guardando el cubo en el bolsillo de su abrigo.',
      },
    ],
  },
  {
    id: 'manual-lumicube',
    title: 'Guía Viva del LumiCube',
    author: 'Laboratorio de Accesibilidad Lumi',
    category: 'Guía práctica',
    summary:
      'Recorrido auditivo por cada cara del Teléfono Cubo con Lumi: desde el botón frontal de IA hasta las compras seguras por voz y NFC.',
    coverAccent: '#FFF9E9',
    chapters: [
      {
        id: 'manual-cap-1',
        number: 1,
        title: 'Cara Frontal y Cara Superior',
        durationSeconds: 68,
        text: 'En la cara frontal del LumiCube encuentras el micrófono central rodeado de luz guía, junto al botón de encendido y menú. En la cara superior, los puntos Braille identifican las acciones de grabar una idea rápida y detener cualquier lectura en curso.',
      },
      {
        id: 'manual-cap-2',
        number: 2,
        title: 'Navegación Lateral y Confirmación',
        durationSeconds: 74,
        text: 'La cara izquierda reúne los botones amplios Anterior y Siguiente para recorrer mensajes o capítulos. La cara derecha concentra los botones Confirmar y Cancelar, pensados para responder sin dudas cuando realizas un pago NFC por voz o confirmas un envío.',
      },
      {
        id: 'manual-cap-3',
        number: 3,
        title: 'Ecosistema de Aplicaciones',
        durationSeconds: 70,
        text: 'La cara inferior conecta el cubo con tus aplicaciones esenciales: mensajería, audios sociales, calendario, calculadora parlante, música, audiolibros y compras asistidas por voz, todo bajo estricta seguridad y privacidad.',
      },
    ],
  },
  {
    id: 'voces-del-sur',
    title: 'Voces del Sur',
    author: 'Antología Sonora',
    category: 'Crónicas y viajes',
    summary:
      'Crónicas narradas con lenguaje claro sobre mercados, lluvia, trenes antiguos y encuentros humanos en ciudades costeras.',
    coverAccent: '#F3EBD0',
    chapters: [
      {
        id: 'sur-cap-1',
        number: 1,
        title: 'El muelle al amanecer',
        durationSeconds: 88,
        text: 'A las seis de la mañana el muelle huele a madera húmeda y pan recién salido del horno. Las gaviotas anuncian la llegada de los primeros botes mientras los pescadores intercambian saludos de orilla a orilla.',
      },
      {
        id: 'sur-cap-2',
        number: 2,
        title: 'Tarde de lluvia y té',
        durationSeconds: 78,
        text: 'Cuando la lluvia golpea las latas del techo, la ciudad entera baja el volumen y escucha. Adentro, una tetera silba suave y la radio lee poemas que viajan por todo el valle.',
      },
    ],
  },
  {
    id: 'respirar-calma',
    title: 'Respirar con Calma',
    author: 'Espacio Bienestar Lumi',
    category: 'Bienestar guiado',
    summary:
      'Sesiones breves de respiración y relajación diseñadas para escuchar con ojos cerrados o leer paso a paso en formato accesible.',
    coverAccent: '#E9E5D9',
    chapters: [
      {
        id: 'calma-cap-1',
        number: 1,
        title: 'Pausa de cuatro tiempos',
        durationSeconds: 60,
        text: 'Sienta tu espalda en un apoyo cómodo. Inhala suave contando hasta cuatro. Sostén el aire dos segundos sin esfuerzo. Exhala despacio contando hasta seis y deja caer los hombros. Repite tres veces sintiendo el ritmo sereno de tu respiración.',
      },
      {
        id: 'calma-cap-2',
        number: 2,
        title: 'Escaneo corporal antes de dormir',
        durationSeconds: 72,
        text: 'Lleva tu atención a las manos y abre los dedos con suavidad. Relaja la mandíbula, suelta la frente y escucha cómo el ambiente se vuelve más silencioso. No hay ninguna tarea pendiente en este minuto; solo descansar.',
      },
    ],
  },
];

function ensureDb(): DatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial: DatabaseState = {
      users: [],
      sessions: [],
      contactsByUser: {},
      messagesByUser: {},
      posts: SEED_POSTS,
      likedPostsByUser: {},
      progressByUser: {},
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    return {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      contactsByUser: parsed.contactsByUser ?? {},
      messagesByUser: parsed.messagesByUser ?? {},
      posts: parsed.posts && parsed.posts.length > 0 ? parsed.posts : SEED_POSTS,
      likedPostsByUser: parsed.likedPostsByUser ?? {},
      progressByUser: parsed.progressByUser ?? {},
    };
  } catch {
    const fallback: DatabaseState = {
      users: [],
      sessions: [],
      contactsByUser: {},
      messagesByUser: {},
      posts: SEED_POSTS,
      likedPostsByUser: {},
      progressByUser: {},
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function saveDb(state: DatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHex: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(storedHex, 'hex');
  if (computed.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(computed, storedBuf);
}

function sanitizeUser(user: StoredUser): LumiUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mode: user.mode,
    alternativeControls: user.alternativeControls,
    identity: user.identity,
    cubePaired: user.cubePaired,
    createdAt: user.createdAt,
  };
}

function getAuthUser(req: express.Request, db: DatabaseState): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Auth routes
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, mode, alternativeControls, identity } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Escribe un nombre de al menos 2 caracteres.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (rawPassword.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    const db = ensureDb();
    if (db.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'Ya existe una cuenta Lumi registrada con ese correo.' });
      return;
    }

    const validModes: AccessibilityMode[] = ['ciego', 'mudo', 'sordo', 'general'];
    const safeMode: AccessibilityMode = validModes.includes(mode) ? mode : 'general';
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(rawPassword, salt);
    const userId = `u_${crypto.randomUUID()}`;
    const newUser: StoredUser = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      mode: safeMode,
      alternativeControls: Boolean(alternativeControls),
      identity: typeof identity === 'string' ? identity.trim() : '',
      cubePaired: false,
      createdAt: new Date().toISOString(),
      passwordSalt: salt,
      passwordHash,
    };

    const token = crypto.randomBytes(32).toString('hex');
    db.users.push(newUser);
    db.sessions.push({ token, userId, createdAt: new Date().toISOString() });
    db.contactsByUser[userId] = [...SEED_CONTACTS];
    db.messagesByUser[userId] = [...SEED_MESSAGES];
    saveDb(db);

    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    const db = ensureDb();
    const user = db.users.find((u) => u.email === cleanEmail);
    if (!user || !verifyPassword(rawPassword, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    saveDb(db);

    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      const db = ensureDb();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      saveDb(db);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const db = ensureDb();
    const user = getAuthUser(req, db);
    if (!user) {
      res.status(401).json({ error: 'Sesión no iniciada.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  });

  app.patch('/api/auth/profile', (req, res) => {
    const db = ensureDb();
    const user = getAuthUser(req, db);
    if (!user) {
      res.status(401).json({ error: 'Debes iniciar sesión para guardar tu perfil.' });
      return;
    }
    const { name, mode, alternativeControls, identity, cubePaired } = req.body ?? {};
    const validModes: AccessibilityMode[] = ['ciego', 'mudo', 'sordo', 'general'];
    if (typeof name === 'string' && name.trim().length >= 1) {
      user.name = name.trim().slice(0, 60);
    }
    if (validModes.includes(mode)) {
      user.mode = mode;
    }
    if (typeof alternativeControls === 'boolean') {
      user.alternativeControls = alternativeControls;
    }
    if (typeof identity === 'string') {
      user.identity = identity.trim().slice(0, 40);
    }
    if (typeof cubePaired === 'boolean') {
      user.cubePaired = cubePaired;
    }
    saveDb(db);
    res.json({ user: sanitizeUser(user) });
  });

  // Messages routes
  app.get('/api/messages', (req, res) => {
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const key = user ? user.id : 'guest';
    const rawContacts = db.contactsByUser[key] ?? SEED_CONTACTS;
    const contacts = rawContacts.map((c) => ({
      ...c,
      recipientMode: c.recipientMode ?? 'general',
    }));
    const messages = db.messagesByUser[key] ?? SEED_MESSAGES;
    res.json({ contacts, messages });
  });

  app.patch('/api/messages/contact-mode', (req, res) => {
    const { contactId, recipientMode } = req.body ?? {};
    const validModes: AccessibilityMode[] = ['ciego', 'mudo', 'sordo', 'general'];
    if (typeof contactId !== 'string' || !validModes.includes(recipientMode)) {
      res.status(400).json({ error: 'Datos inválidos para actualizar el modo del receptor.' });
      return;
    }
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const key = user ? user.id : 'guest';
    if (!db.contactsByUser[key]) db.contactsByUser[key] = [...SEED_CONTACTS];
    const target = db.contactsByUser[key].find((c) => c.id === contactId);
    if (!target) {
      res.status(404).json({ error: 'Contacto no encontrado.' });
      return;
    }
    target.recipientMode = recipientMode;
    target.preferredChannel =
      recipientMode === 'ciego'
        ? 'Narración por voz + LumiCube'
        : recipientMode === 'sordo'
          ? 'Texto claro + Señas + Pictogramas'
          : recipientMode === 'mudo'
            ? 'Texto + Frases habladas'
            : 'Multimodal (texto y audio)';
    saveDb(db);
    res.json({ contact: target });
  });

  app.post('/api/messages', async (req, res) => {
    const { contactId, text, modality, newContactName, newContactMode, recipientMode } =
      req.body ?? {};
    const cleanText = typeof text === 'string' ? text.trim() : '';
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const key = user ? user.id : 'guest';
    const validModes: AccessibilityMode[] = ['ciego', 'mudo', 'sordo', 'general'];

    if (!db.contactsByUser[key]) db.contactsByUser[key] = [...SEED_CONTACTS];
    if (!db.messagesByUser[key]) db.messagesByUser[key] = [...SEED_MESSAGES];

    if (typeof newContactName === 'string' && newContactName.trim().length >= 2) {
      const contactName = newContactName.trim().slice(0, 40);
      const safeRecipientMode: AccessibilityMode = validModes.includes(newContactMode)
        ? newContactMode
        : 'general';
      const id = `c_${crypto.randomUUID().slice(0, 8)}`;
      const created: ContactThread = {
        id,
        name: contactName,
        role: 'Contacto guardado',
        preferredChannel:
          safeRecipientMode === 'ciego'
            ? 'Narración por voz + LumiCube'
            : safeRecipientMode === 'sordo'
              ? 'Texto claro + Señas + Pictogramas'
              : safeRecipientMode === 'mudo'
                ? 'Texto + Frases habladas'
                : 'Texto y audio',
        recipientMode: safeRecipientMode,
      };
      db.contactsByUser[key].push(created);
      saveDb(db);
      res.status(201).json({ contact: created });
      return;
    }

    if (!cleanText || cleanText.length > 800) {
      res.status(400).json({ error: 'El mensaje debe tener entre 1 y 800 caracteres.' });
      return;
    }

    const targetContact =
      db.contactsByUser[key].find((c) => c.id === contactId) ?? db.contactsByUser[key][0];
    const targetContactId = targetContact?.id ?? 'familia';
    const effectiveRecipientMode: AccessibilityMode = validModes.includes(recipientMode)
      ? recipientMode
      : targetContact?.recipientMode ?? 'general';

    let transformed = buildServerTransformedPayload(cleanText, effectiveRecipientMode);

    // Enriquecimiento opcional con Gemini para transformación semántica precisa según el receptor
    const ai = getAiClient();
    if (ai) {
      try {
        const aiRes = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Mensaje original: "${cleanText}"\nModo del receptor: ${effectiveRecipientMode}`,
          config: {
            systemInstruction:
              'Eres el motor de comunicación accesible de Lumi. Adapta el mensaje exactamente para el receptor: si es "ciego", crea un guion claro y natural para audio sin abreviaturas; si es "sordo", divide en frases cortas de lectura fácil y glosas de lengua de señas en MAYÚSCULAS; si es "mudo", redacta el texto claro y 3 respuestas rápidas muy útiles para que el receptor responda con un toque; si es "general", texto claro. Responde en JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                adaptedHeadline: { type: Type.STRING },
                adaptedText: { type: Type.STRING },
                audioScript: { type: Type.STRING },
                suggestedReplies: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['adaptedHeadline', 'adaptedText', 'audioScript', 'suggestedReplies'],
            },
          },
        });
        const parsed = JSON.parse((aiRes.text ?? '{}').trim()) as {
          adaptedHeadline?: string;
          adaptedText?: string;
          audioScript?: string;
          suggestedReplies?: string[];
        };
        transformed = {
          ...transformed,
          adaptedHeadline: parsed.adaptedHeadline || transformed.adaptedHeadline,
          adaptedText: parsed.adaptedText || transformed.adaptedText,
          audioScript: parsed.audioScript || transformed.audioScript,
          suggestedReplies:
            Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0
              ? parsed.suggestedReplies.slice(0, 4)
              : transformed.suggestedReplies,
          source: 'gemini',
        };
      } catch {
        // Mantiene transformación local determinista sin interrumpir el envío
      }
    }

    const msg: ChatMessage = {
      id: `m_${crypto.randomUUID()}`,
      contactId: targetContactId,
      sender: 'me',
      senderName: user?.name || 'Tú',
      text: cleanText,
      modality:
        modality === 'voz' || modality === 'frase_rapida' ? modality : 'texto',
      transformed,
      createdAt: new Date().toISOString(),
    };
    db.messagesByUser[key].push(msg);

    let autoReply: ChatMessage | null = null;
    if (targetContactId === 'soporte' || targetContactId === 'diego' || targetContactId === 'camila') {
      const replyText =
        targetContactId === 'soporte'
          ? `Recibimos tu mensaje: "${cleanText}". Recuerda que puedes usar los 9 botones del LumiCube para responder.`
          : targetContactId === 'diego'
            ? `Recibí tu mensaje en formato visual y señas. ¡Muchas gracias!`
            : `Escuché tu mensaje por voz con claridad. ¡Gracias por escribirme!`;
      autoReply = {
        id: `m_${crypto.randomUUID()}`,
        contactId: targetContactId,
        sender: 'contact',
        senderName: targetContact?.name ?? 'Lumi',
        text: replyText,
        modality: targetContactId === 'camila' ? 'voz' : 'texto',
        transformed: buildServerTransformedPayload(replyText, user?.mode ?? 'general'),
        createdAt: new Date(Date.now() + 250).toISOString(),
      };
      db.messagesByUser[key].push(autoReply);
    }

    saveDb(db);
    res.status(201).json({ message: msg, autoReply });
  });

  // Social feed routes
  app.get('/api/social', (req, res) => {
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const likedIds = new Set(user ? db.likedPostsByUser[user.id] ?? [] : db.likedPostsByUser['guest'] ?? []);
    const posts = db.posts.map((post) => ({
      ...post,
      likedByUser: likedIds.has(post.id),
    }));
    res.json({ posts });
  });

  app.post('/api/social', (req, res) => {
    const {
      content,
      category,
      altDescription,
      authorName,
      authorMode,
      videoDataUrl,
      videoTranscript,
    } = req.body ?? {};

    const safeVideoDataUrl =
      typeof videoDataUrl === 'string' &&
      videoDataUrl.startsWith('data:video/') &&
      videoDataUrl.length <= 18_000_000
        ? videoDataUrl
        : undefined;
    const safeTranscript =
      typeof videoTranscript === 'string' && videoTranscript.trim()
        ? videoTranscript.trim().slice(0, 1500)
        : undefined;

    const cleanContent =
      typeof content === 'string' && content.trim()
        ? content.trim()
        : safeVideoDataUrl
          ? safeTranscript || 'Video compartido en la comunidad Lumi'
          : '';
    if (!cleanContent || cleanContent.length > 600) {
      res.status(400).json({ error: 'La publicación debe tener entre 1 y 600 caracteres.' });
      return;
    }

    const db = ensureDb();
    const user = getAuthUser(req, db);
    const validCategories = ['comunidad', 'audio', 'senas', 'consejos'] as const;
    const safeCat = validCategories.includes(category) ? category : 'comunidad';
    const validModes: AccessibilityMode[] = ['ciego', 'mudo', 'sordo', 'general'];
    const safeMode: AccessibilityMode = user?.mode ?? (validModes.includes(authorMode) ? authorMode : 'general');

    const newPost: SocialPost = {
      id: `p_${crypto.randomUUID()}`,
      authorId: user?.id ?? 'guest',
      authorName: user?.name || (typeof authorName === 'string' && authorName.trim()) || 'Invitado Lumi',
      authorMode: safeMode,
      category: safeCat,
      content: cleanContent,
      altDescription: typeof altDescription === 'string' ? altDescription.trim().slice(0, 160) : undefined,
      videoDataUrl: safeVideoDataUrl,
      videoTranscript: safeTranscript,
      likes: 0,
      likedByUser: false,
      comments: [],
      createdAt: new Date().toISOString(),
    };
    db.posts.unshift(newPost);
    saveDb(db);
    res.status(201).json({ post: newPost });
  });

  app.post('/api/social/:id/like', (req, res) => {
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const userKey = user ? user.id : 'guest';
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Publicación no encontrada.' });
      return;
    }
    const likedList = db.likedPostsByUser[userKey] ?? [];
    const alreadyLiked = likedList.includes(post.id);
    if (alreadyLiked) {
      db.likedPostsByUser[userKey] = likedList.filter((id) => id !== post.id);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      db.likedPostsByUser[userKey] = [...likedList, post.id];
      post.likes += 1;
    }
    saveDb(db);
    res.json({ post: { ...post, likedByUser: !alreadyLiked } });
  });

  app.post('/api/social/:id/comments', (req, res) => {
    const { text, authorName } = req.body ?? {};
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (!cleanText || cleanText.length > 300) {
      res.status(400).json({ error: 'El comentario debe tener entre 1 y 300 caracteres.' });
      return;
    }
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Publicación no encontrada.' });
      return;
    }
    const comment = {
      id: `cm_${crypto.randomUUID()}`,
      authorName: user?.name || (typeof authorName === 'string' && authorName.trim()) || 'Invitado Lumi',
      text: cleanText,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    saveDb(db);
    res.status(201).json({ comment });
  });

  // Audiobooks routes
  app.get('/api/audiobooks', (req, res) => {
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const key = user ? user.id : 'guest';
    const progress = db.progressByUser[key] ?? {};
    res.json({ books: AUDIOBOOKS_CATALOG, progress });
  });

  app.post('/api/audiobooks/progress', (req, res) => {
    const { bookId, chapterId, positionPercent } = req.body ?? {};
    if (typeof bookId !== 'string' || typeof chapterId !== 'string') {
      res.status(400).json({ error: 'Datos de progreso inválidos.' });
      return;
    }
    const db = ensureDb();
    const user = getAuthUser(req, db);
    const key = user ? user.id : 'guest';
    if (!db.progressByUser[key]) db.progressByUser[key] = {};
    const record: AudiobookProgress = {
      bookId,
      chapterId,
      positionPercent: Math.min(100, Math.max(0, Number(positionPercent) || 0)),
      updatedAt: new Date().toISOString(),
    };
    db.progressByUser[key][bookId] = record;
    saveDb(db);
    res.json({ progress: record });
  });

  // Gemini AI: Asistente Lumi
  app.post('/api/ai/assistant', async (req, res) => {
    const { message, mode, userName, history } = req.body ?? {};
    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    if (!cleanMessage) {
      res.status(400).json({ error: 'Escribe o dicta una pregunta para Lumi.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.json({
        reply:
          'Hola, soy Lumi. Puedo ayudarte a navegar por Mensajes, Red social, Traductor de comunicación, Lengua de señas, Audiolibros o a explorar tu futuro LumiCube. (Nota: configura GEMINI_API_KEY en Secrets para activar respuestas generativas completas).',
        suggestedSection: null,
        source: 'local',
      });
      return;
    }

    try {
      const modeContext =
        mode === 'ciego'
          ? 'La persona usa el modo CIEGO (prioriza respuestas cortas, claras para leer en voz alta y sin depender de lo visual).'
          : mode === 'mudo'
            ? 'La persona usa el modo MUDO (valora frases prácticas listas para mostrar o reproducir en voz alta).'
            : mode === 'sordo'
              ? 'La persona usa el modo SORDO (prioriza texto muy estructurado, claro y apoyo visual o en lengua de señas).'
              : 'La persona usa el modo general multimodal.';

      const recentHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h: { role?: string; text?: string }) => `${h.role === 'user' ? 'Usuario' : 'Lumi'}: ${h.text ?? ''}`)
            .join('\n')
        : '';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${recentHistory ? `Historial reciente:\n${recentHistory}\n\n` : ''}Consulta actual de ${userName || 'la persona'}: ${cleanMessage}`,
        config: {
          systemInstruction:
            `Eres Lumi, un asistente personal empático, claro y accesible en español para la plataforma Lumi y el futuro producto físico Teléfono Cubo con Lumi (LumiCube). ${modeContext} Responde en un máximo de 3 a 4 oraciones claras, sin jerga técnica innecesaria. Si la persona pregunta por una función (mensajes, red social, traductor, lengua de señas, audiolibros o LumiCube), explícala brevemente y sugiere la sección correspondiente.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Respuesta clara, cálida y accesible en español.',
              },
              suggestedSection: {
                type: Type.STRING,
                description:
                  'Opcional: uno de mensajes, social, traductor, senas, audiolibros, lumicube, o none.',
              },
            },
            required: ['reply', 'suggestedSection'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        reply?: string;
        suggestedSection?: string;
      };
      const validSections = ['mensajes', 'social', 'traductor', 'senas', 'audiolibros', 'lumicube'];
      res.json({
        reply: parsed.reply || 'Estoy aquí para ayudarte dentro de Lumi.',
        suggestedSection: validSections.includes(parsed.suggestedSection ?? '')
          ? parsed.suggestedSection
          : null,
        source: 'gemini',
      });
    } catch (error) {
      console.error('Gemini assistant error:', error);
      res.status(502).json({
        error: 'No se pudo consultar al Asistente Lumi en este momento. Inténtalo de nuevo.',
      });
    }
  });

  // Gemini AI: Traductor de comunicación multimodal
  app.post('/api/ai/translate', async (req, res) => {
    const { text, target } = req.body ?? {};
    const cleanText = typeof text === 'string' ? text.trim() : '';
    const targetMode = (typeof target === 'string' ? target : 'lectura_facil') as TranslationTarget;
    if (!cleanText) {
      res.status(400).json({ error: 'Ingresa el mensaje que deseas adaptar o traducir.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Servicio de IA no configurado en el servidor.' });
      return;
    }

    try {
      const targetInstructions: Record<TranslationTarget, string> = {
        lectura_facil:
          'Convierte el texto a Lectura Fácil en español: frases cortas, vocabulario cotidiano, una idea por línea.',
        senas_glosa:
          'Convierte el texto a glosa estructurada para Lengua de Señas (en MAYÚSCULAS, orden visual sujeto-objeto-acción sin artículos innecesarios) y explica brevemente las señas clave.',
        pictogramas:
          'Descompón el mensaje en una secuencia clara de 3 a 6 pictogramas con emoji representativo y palabra clave simple.',
        en: 'Traduce el mensaje al inglés natural, claro y respetuoso, incluyendo pasos clave de pronunciación o uso.',
        pt: 'Traduce el mensaje al portugués natural, claro y respetuoso, incluyendo notas breves de uso.',
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Texto original: "${cleanText}"\nObjetivo: ${targetInstructions[targetMode] ?? targetInstructions.lectura_facil}`,
        config: {
          systemInstruction:
            'Eres un especialista en comunicación accesible y traducción multimodal de Lumi. Responde estrictamente en JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              adaptedText: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              pictograms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    symbol: { type: Type.STRING },
                    label: { type: Type.STRING },
                  },
                  required: ['symbol', 'label'],
                },
              },
            },
            required: ['headline', 'adaptedText', 'steps', 'pictograms'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        target: targetMode,
        headline: parsed.headline || 'Resultado accesible',
        adaptedText: parsed.adaptedText || cleanText,
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        pictograms: Array.isArray(parsed.pictograms) ? parsed.pictograms : [],
        source: 'gemini',
      });
    } catch (error) {
      console.error('Gemini translate error:', error);
      res.status(502).json({ error: 'No se pudo completar la traducción en este momento.' });
    }
  });

  // Gemini AI: Descomposición de frases a Lengua de Señas
  app.post('/api/ai/sign-phrase', async (req, res) => {
    const { phrase } = req.body ?? {};
    const cleanPhrase = typeof phrase === 'string' ? phrase.trim() : '';
    if (!cleanPhrase) {
      res.status(400).json({ error: 'Escribe una frase para convertirla a lengua de señas.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Servicio de IA no configurado en el servidor.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Convierte esta frase en español a pasos claros para practicar en Lengua de Señas: "${cleanPhrase}"`,
        config: {
          systemInstruction:
            'Eres instructor de Lengua de Señas (LSCh/LSE) para la app accesible Lumi. Descompón la frase en orden visual de señas (glosas en mayúsculas) y describe de forma práctica la posición de manos y movimiento para cada paso.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    token: { type: Type.STRING },
                    gloss: { type: Type.STRING },
                    cue: { type: Type.STRING },
                  },
                  required: ['token', 'gloss', 'cue'],
                },
              },
            },
            required: ['steps'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        source: 'gemini',
      });
    } catch (error) {
      console.error('Gemini sign-phrase error:', error);
      res.status(502).json({ error: 'No se pudo analizar la frase en señas.' });
    }
  });

  // Gemini AI: Text-to-Speech (gemini-3.8-flash-lite-tts)
  app.post('/api/ai/tts', async (req, res) => {
    const { text, style, voiceGender } = req.body ?? {};
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 1200) : '';
    if (!cleanText) {
      res.status(400).json({ error: 'No hay texto para narrar.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini TTS no configurado en el servidor.' });
      return;
    }

    const chosenVoiceName = voiceGender === 'hombre' ? 'Charon' : 'Aoede';
    const defaultStyle =
      voiceGender === 'hombre'
        ? 'Warm, deep, relaxed, unhurried masculine Spanish audiobook narrator'
        : 'Warm, gentle, relaxed, feminine Spanish audiobook narrator';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style:
                    typeof style === 'string' && style.trim()
                      ? style.trim()
                      : defaultStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'No se recibió audio del servicio TTS.' });
        return;
      }
      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (error) {
      console.error('Gemini TTS error:', error);
      res.status(502).json({ error: 'Error al generar narración de voz.' });
    }
  });

  // Gemini AI: Transcripción de audio/video a palabras (subtítulos accesibles)
  app.post('/api/ai/transcribe-media', async (req, res) => {
    const { mediaBase64, mimeType } = req.body ?? {};
    if (typeof mediaBase64 !== 'string' || !mediaBase64 || mediaBase64.length > 18_000_000) {
      res.status(400).json({ error: 'Archivo multimedia inválido o demasiado grande.' });
      return;
    }
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini IA no configurado en el servidor.' });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: mediaBase64,
                  mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'video/mp4',
                },
              },
              {
                text: 'Transcribe exactamente a palabras en español todo lo que se escucha en este video o audio, de forma clara y sin comentarios extra. Si no hay voz audible, responde: "Sin voz audible detectada."',
              },
            ],
          },
        ],
      });
      const transcript = (response.text ?? '').trim();
      res.json({ transcript });
    } catch (error) {
      console.error('Gemini transcribe-media error:', error);
      res.status(502).json({ error: 'No se pudo transcribir el audio del video.' });
    }
  });

  // Salas en vivo Celu <-> PC (almacenamiento en memoria por código de sala)
  const liveRooms = new Map<string, Array<Record<string, unknown>>>();

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || 'LUMI-942').trim().toUpperCase();
    res.json({ entries: liveRooms.get(code) ?? [] });
  });

  app.post('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || 'LUMI-942').trim().toUpperCase();
    const entry = req.body as Record<string, unknown>;
    if (!entry || typeof entry !== 'object' || !entry.id) {
      res.status(400).json({ error: 'Entrada de sala inválida.' });
      return;
    }
    const list = liveRooms.get(code) ?? [];
    if (!list.some((item) => item.id === entry.id)) {
      list.push(entry);
      if (list.length > 60) list.shift();
      liveRooms.set(code, list);
    }
    res.json({ ok: true, count: list.length });
  });

  const isProduction =
    process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lumi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
