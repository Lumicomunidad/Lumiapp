export type AccessibilityMode = 'ciego' | 'mudo' | 'sordo' | 'general';

export type AppSectionId =
  | 'home'
  | 'mensajes'
  | 'social'
  | 'traductor'
  | 'senas'
  | 'calendario'
  | 'certificados'
  | 'asistente'
  | 'audiolibros'
  | 'lumicube';

export type ReminderStatus = 'proximamente' | 'hoy' | 'finalizado';

export interface LumiReminder {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  note?: string;
  status: ReminderStatus;
  notifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveRoomEntry {
  id: string;
  roomCode: string;
  senderName: string;
  senderMode: AccessibilityMode;
  kind: 'transcript' | 'text' | 'quick_reply' | 'audio' | 'alert';
  text: string;
  audioDataUrl?: string;
  audioDurationSec?: number;
  alertType?: 'luz' | 'sonido' | 'vibracion';
  createdAt: string;
}

export interface LumiUser {
  id: string;
  name: string;
  email: string;
  mode: AccessibilityMode;
  alternativeControls: boolean;
  identity: string;
  cubePaired: boolean;
  createdAt: string;
}

export interface TransformedMessagePayload {
  recipientMode: AccessibilityMode;
  modeLabel: string;
  adaptedHeadline: string;
  adaptedText: string;
  audioScript: string;
  signGloss: SignPhraseStep[];
  pictograms: Array<{ symbol: string; label: string }>;
  tactileCue: string;
  suggestedReplies: string[];
  source: 'gemini' | 'local';
}

export interface ChatMessage {
  id: string;
  contactId: string;
  sender: 'me' | 'contact';
  senderName: string;
  text: string;
  modality: 'texto' | 'voz' | 'frase_rapida';
  transformed?: TransformedMessagePayload;
  createdAt: string;
}

export interface ContactThread {
  id: string;
  name: string;
  role: string;
  preferredChannel: string;
  recipientMode: AccessibilityMode;
}

export interface SocialComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorMode: AccessibilityMode;
  category: 'comunidad' | 'audio' | 'senas' | 'consejos';
  content: string;
  altDescription?: string;
  videoDataUrl?: string;
  videoTranscript?: string;
  likes: number;
  likedByUser: boolean;
  comments: SocialComment[];
  createdAt: string;
}

export type TranslationTarget =
  | 'lectura_facil'
  | 'senas_glosa'
  | 'pictogramas'
  | 'en'
  | 'pt';

export interface TranslationResult {
  target: TranslationTarget;
  headline: string;
  adaptedText: string;
  steps: string[];
  pictograms: { symbol: string; label: string }[];
  source: 'gemini' | 'local';
}

export interface SignEntry {
  id: string;
  word: string;
  category: 'saludos' | 'emergencia' | 'cotidiano' | 'lumi';
  handshape: string;
  location: string;
  movement: string;
  expression: string;
  gestureIcon: string;
}

export interface SignPhraseStep {
  token: string;
  gloss: string;
  cue: string;
}

export interface AudiobookChapter {
  id: string;
  number: number;
  title: string;
  durationSeconds: number;
  text: string;
}

export interface Audiobook {
  id: string;
  title: string;
  author: string;
  category: string;
  summary: string;
  coverAccent: string;
  chapters: AudiobookChapter[];
}

export interface AudiobookProgress {
  bookId: string;
  chapterId: string;
  positionPercent: number;
  updatedAt: string;
}

export interface AssistantTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestedAction?: {
    label: string;
    section: AppSectionId;
  };
  createdAt: string;
}

export interface CubeFaceSpec {
  id: 'frontal' | 'superior' | 'trasera' | 'izquierda' | 'derecha' | 'inferior';
  name: string;
  brailleDots?: number[];
  primaryFunction: string;
  description: string;
  controls: string[];
}

export interface CubeButtonSpec {
  number: number;
  label: string;
  shortSymbol: string;
  action:
    | 'power_menu'
    | 'record'
    | 'play'
    | 'pause'
    | 'stop'
    | 'prev'
    | 'next'
    | 'confirm'
    | 'cancel';
  description: string;
}
