import type {
  Audiobook,
  AudiobookProgress,
  ChatMessage,
  ContactThread,
  LumiUser,
  SocialPost,
  TranslationResult,
  TranslationTarget,
  SignPhraseStep,
  AccessibilityMode,
} from '../types/lumi';

const TOKEN_STORAGE_KEY = 'lumi_session_token';
const CACHE_PREFIX = 'lumi_cache_v1_';

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage quota issues
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error de comunicación con el servidor.');
  }
  return data as T;
}

export async function registerAccount(payload: {
  name: string;
  email: string;
  password: string;
  mode: AccessibilityMode;
  alternativeControls: boolean;
  identity: string;
}): Promise<{ token: string; user: LumiUser }> {
  const data = await apiFetch<{ token: string; user: LumiUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setStoredToken(data.token);
  return data;
}

export async function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<{ token: string; user: LumiUser }> {
  const data = await apiFetch<{ token: string; user: LumiUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setStoredToken(data.token);
  return data;
}

export async function logoutAccount(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  setStoredToken(null);
  try {
    localStorage.removeItem(`${CACHE_PREFIX}user`);
  } catch {
    // Ignore
  }
}

export async function fetchCurrentUser(): Promise<LumiUser | null> {
  if (!getStoredToken()) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3500);
  try {
    const data = await apiFetch<{ user: LumiUser }>('/api/auth/me', {
      signal: controller.signal,
    });
    writeCache('user', data.user);
    return data.user;
  } catch {
    const cached = readCache<LumiUser>('user');
    if (cached) return cached;
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function updateUserProfile(
  patch: Partial<Pick<LumiUser, 'name' | 'mode' | 'alternativeControls' | 'identity' | 'cubePaired'>>
): Promise<LumiUser> {
  const data = await apiFetch<{ user: LumiUser }>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.user;
}

export async function fetchMessages(): Promise<{
  contacts: ContactThread[];
  messages: ChatMessage[];
}> {
  try {
    const data = await apiFetch<{ contacts: ContactThread[]; messages: ChatMessage[] }>('/api/messages');
    writeCache('messages', data);
    return data;
  } catch (err) {
    const cached = readCache<{ contacts: ContactThread[]; messages: ChatMessage[] }>('messages');
    if (cached) return cached;
    throw err;
  }
}

export async function sendMessage(payload: {
  contactId: string;
  text: string;
  modality: 'texto' | 'voz' | 'frase_rapida';
  recipientMode?: AccessibilityMode;
}): Promise<{ message: ChatMessage; autoReply: ChatMessage | null }> {
  return apiFetch('/api/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createContact(
  newContactName: string,
  newContactMode: AccessibilityMode = 'general'
): Promise<{ contact: ContactThread }> {
  return apiFetch('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ newContactName, newContactMode }),
  });
}

export async function updateContactRecipientMode(
  contactId: string,
  recipientMode: AccessibilityMode
): Promise<{ contact: ContactThread }> {
  return apiFetch('/api/messages/contact-mode', {
    method: 'PATCH',
    body: JSON.stringify({ contactId, recipientMode }),
  });
}

export async function fetchSocialPosts(): Promise<{ posts: SocialPost[] }> {
  try {
    const data = await apiFetch<{ posts: SocialPost[] }>('/api/social');
    // Omitir videos pesados en localStorage para no exceder la cuota del navegador
    writeCache('social', {
      posts: data.posts.map(({ videoDataUrl: _omit, ...rest }) => rest),
    });
    return data;
  } catch (err) {
    const cached = readCache<{ posts: SocialPost[] }>('social');
    if (cached) return cached;
    throw err;
  }
}

export async function createSocialPost(payload: {
  content: string;
  category: 'comunidad' | 'audio' | 'senas' | 'consejos';
  altDescription?: string;
  authorName?: string;
  authorMode?: AccessibilityMode;
  videoDataUrl?: string;
  videoTranscript?: string;
}): Promise<{ post: SocialPost }> {
  return apiFetch('/api/social', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function toggleLikeSocialPost(postId: string): Promise<{ post: SocialPost }> {
  return apiFetch(`/api/social/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
  });
}

export async function addSocialComment(
  postId: string,
  text: string,
  authorName?: string
): Promise<{ comment: { id: string; authorName: string; text: string; createdAt: string } }> {
  return apiFetch(`/api/social/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, authorName }),
  });
}

export async function fetchAudiobooks(): Promise<{
  books: Audiobook[];
  progress: Record<string, AudiobookProgress>;
}> {
  try {
    const data = await apiFetch<{ books: Audiobook[]; progress: Record<string, AudiobookProgress> }>(
      '/api/audiobooks'
    );
    writeCache('audiobooks', data);
    return data;
  } catch (err) {
    const cached = readCache<{ books: Audiobook[]; progress: Record<string, AudiobookProgress> }>(
      'audiobooks'
    );
    if (cached) return cached;
    throw err;
  }
}

export async function saveAudiobookProgress(payload: {
  bookId: string;
  chapterId: string;
  positionPercent: number;
}): Promise<{ progress: AudiobookProgress }> {
  return apiFetch('/api/audiobooks/progress', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function askLumiAssistant(payload: {
  message: string;
  mode: AccessibilityMode;
  userName?: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<{ reply: string; suggestedSection: string | null; source: 'gemini' | 'local' }> {
  return apiFetch('/api/ai/assistant', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function translateCommunication(payload: {
  text: string;
  target: TranslationTarget;
}): Promise<TranslationResult> {
  return apiFetch('/api/ai/translate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function analyzeSignPhrase(phrase: string): Promise<{
  steps: SignPhraseStep[];
  source: 'gemini' | 'local';
}> {
  return apiFetch('/api/ai/sign-phrase', {
    method: 'POST',
    body: JSON.stringify({ phrase }),
  });
}

export async function requestGeminiTts(
  text: string,
  style?: string,
  voiceGender?: 'mujer' | 'hombre'
): Promise<string> {
  const data = await apiFetch<{ audioBase64: string; mimeType: string }>('/api/ai/tts', {
    method: 'POST',
    body: JSON.stringify({ text, style, voiceGender }),
  });
  return data.audioBase64;
}

export async function transcribeMediaWithGemini(
  mediaBase64: string,
  mimeType: string
): Promise<string> {
  const data = await apiFetch<{ transcript: string }>('/api/ai/transcribe-media', {
    method: 'POST',
    body: JSON.stringify({ mediaBase64, mimeType }),
  });
  return data.transcript;
}
