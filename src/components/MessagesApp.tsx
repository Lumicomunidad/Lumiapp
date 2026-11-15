import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  Send,
  Volume2,
  Plus,
  ArrowLeft,
  Check,
  Eye,
  ArrowRightLeft,
  MessageSquare,
  PhoneCall,
} from 'lucide-react';
import { LiveRoomPanel } from './LiveRoomPanel';
import type { AccessibilityMode, ChatMessage, ContactThread } from '../types/lumi';
import {
  MODE_METADATA,
  extractRoomCodeFromSpeech,
  isHangupVoiceCommand,
  normalizeVoice,
  transformMessageForRecipient,
  validateNonEmptyText,
} from '../utils/lumiLogic';
import {
  createContact,
  fetchMessages,
  sendMessage,
  updateContactRecipientMode,
} from '../utils/api';
import {
  isSpeechRecognitionSupported,
  speakWithBestVoice,
  startSingleSpeechCapture,
} from '../utils/speech';

interface MessagesAppProps {
  mode: AccessibilityMode;
  alternativeControls: boolean;
  userName?: string;
  registerVoiceHandler?: (handler: ((transcript: string) => string | null) | null) => void;
  onBack: () => void;
}

const QUICK_PHRASES = [
  'Hola, estoy usando Lumi.',
  'Necesito ayuda, por favor.',
  '¿Puedes repetirlo más despacio o escribirlo?',
  'Ya llegué bien a casa, gracias.',
];

export const MessagesApp: React.FC<MessagesAppProps> = ({
  mode,
  alternativeControls,
  userName,
  registerVoiceHandler,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'sala'>('chats');
  const [roomCode, setRoomCode] = useState('LUMI-942');
  const [autoStartAudioRecord, setAutoStartAudioRecord] = useState(false);
  const roomVoiceHandlerRef = useRef<((transcript: string) => string | null) | null>(null);
  const [contacts, setContacts] = useState<ContactThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeContactId, setActiveContactId] = useState('diego');
  const [perspective, setPerspective] = useState<'sender' | 'recipient'>('sender');
  const [draft, setDraft] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactMode, setNewContactMode] = useState<AccessibilityMode>('sordo');
  const [showAddContact, setShowAddContact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let mounted = true;
    fetchMessages()
      .then((data) => {
        if (!mounted) return;
        setContacts(data.contacts);
        setMessages(data.messages);
        if (data.contacts.length > 0) {
          const preferred =
            data.contacts.find((c) => c.id === 'diego') ?? data.contacts[0];
          setActiveContactId(preferred.id);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'No se pudieron cargar los mensajes.'
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
  return () => {
      mounted = false;
    };
  }, []);

  const activeContact = contacts.find((c) => c.id === activeContactId) ?? contacts[0];
  const recipientMode: AccessibilityMode = activeContact?.recipientMode ?? 'general';
  const threadMessages = messages.filter((m) => m.contactId === activeContactId);

  const livePreview = useMemo(() => {
    const sampleText = draft.trim() || 'Hola xfa avísame cuando llegues a casa';
    return transformMessageForRecipient(sampleText, mode, recipientMode);
  }, [draft, mode, recipientMode]);

  const handleSend = async (
    textToSend: string,
    modality: 'texto' | 'voz' | 'frase_rapida' = 'texto'
  ) => {
    const err = validateNonEmptyText(textToSend, 1, 800);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSending(true);
    try {
      const res = await sendMessage({
        contactId: activeContactId,
        text: textToSend.trim(),
        modality,
        recipientMode,
      });
      setMessages((prev) => {
        const next = [...prev, res.message];
        if (res.autoReply) next.push(res.autoReply);
        return next;
      });
      if (modality === 'texto' || modality === 'voz') {
        setDraft('');
      }
      setFeedback(
        `Mensaje transformado para receptor en modo ${MODE_METADATA[recipientMode].label}.`
      );
      if (mode === 'ciego' && !alternativeControls) {
        const replySpeech = res.autoReply
          ? `Mensaje enviado. ${res.autoReply.senderName} respondió: ${res.autoReply.transformed?.audioScript || res.autoReply.text}`
          : `Mensaje enviado y adaptado: ${res.message.text}`;
        speakWithBestVoice(replySpeech);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleChangeRecipientMode = async (nextMode: AccessibilityMode) => {
    if (!activeContact) return;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === activeContact.id ? { ...c, recipientMode: nextMode } : c
      )
    );
    try {
      const res = await updateContactRecipientMode(activeContact.id, nextMode);
      setContacts((prev) =>
        prev.map((c) => (c.id === res.contact.id ? res.contact : c))
      );
      setFeedback(
        `Ahora ${res.contact.name} recibe mensajes adaptados a modo ${MODE_METADATA[nextMode].label}.`
      );
    } catch {
      // Mantiene cambio local si falla la red
    }
  };

  const handleDictate = () => {
    if (!isSpeechRecognitionSupported()) {
      setError('El dictado por voz requiere Google Chrome o Microsoft Edge.');
      return;
    }
    setError('');
    setDictating(true);
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setDictating(false);
        setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      onError: (msg) => {
        setDictating(false);
        setError(msg);
      },
      onEnd: () => setDictating(false),
    });
  };

  const handleDictateAndSend = () => {
    if (!isSpeechRecognitionSupported()) {
      setError('El dictado por voz requiere Google Chrome o Microsoft Edge.');
      return;
    }
    setError('');
    setDictating(true);
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setDictating(false);
        if (transcript.trim()) {
          void handleSend(transcript.trim(), 'voz');
        }
      },
      onError: (msg) => {
        setDictating(false);
        setError(msg);
      },
      onEnd: () => setDictating(false),
    });
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newContactName.trim().length < 2) {
      setError('Escribe un nombre de al menos 2 caracteres para el contacto.');
      return;
    }
    setError('');
    try {
      const res = await createContact(newContactName.trim(), newContactMode);
      setContacts((prev) => [...prev, res.contact]);
      setActiveContactId(res.contact.id);
      setNewContactName('');
      setShowAddContact(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el contacto.');
    }
  };

  useEffect(() => {
    if (!registerVoiceHandler) return;
    registerVoiceHandler((transcript: string) => {
      const norm = normalizeVoice(transcript);

      if (activeTab === 'sala' && roomVoiceHandlerRef.current) {
        const roomReply = roomVoiceHandlerRef.current(transcript);
        if (roomReply) return roomReply;
      }

      if (
        norm.includes('graba un audio') ||
        norm.includes('grabar audio') ||
        norm === 'grabar'
      ) {
        setActiveTab('sala');
        setAutoStartAudioRecord(true);
        return '[SILENT] Abriendo sala y grabando audio en silencio. Toca la pantalla o di "Para" para detener.';
      }

      if (isHangupVoiceCommand(transcript)) {
        setActiveTab('chats');
        return 'Llamada finalizada (colgar). Volviendo a chats.';
      }

      if (norm.includes('salir de sala') || (norm === 'salir' && activeTab === 'sala')) {
        setActiveTab('chats');
        return 'Saliste de la sala en vivo.';
      }

      const requestedRoom = extractRoomCodeFromSpeech(transcript);
      if (requestedRoom) {
        setRoomCode(requestedRoom);
        setActiveTab('sala');
        return `Uniéndote a la sala ${requestedRoom}.`;
      }

      if (norm.includes('abrir sala') || norm.includes('llamada') || norm.includes('en vivo')) {
        setActiveTab('sala');
        return `Abriendo sala en vivo ${roomCode}.`;
      }

      if (norm.includes('chat') || norm.includes('contacto')) {
        setActiveTab('chats');
        return 'Mostrando chats por contacto.';
      }

      const matchedContact = contacts.find((c) =>
        norm.includes(normalizeVoice(c.name.split('(')[0]))
      );
      if (matchedContact) {
        setActiveTab('chats');
        setActiveContactId(matchedContact.id);
        return `Conversación abierta con ${matchedContact.name}.`;
      }

      if (norm.startsWith('enviar ')) {
        const textBody = transcript.slice(7).trim();
        if (textBody) {
          handleSend(textBody, 'voz');
          return `Mensaje enviado: "${textBody}".`;
        }
      }

      return null;
    });

    return () => registerVoiceHandler(null);
  }, [registerVoiceHandler, activeTab, roomCode, contacts]);

  return (
    <section aria-labelledby="messages-heading" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al menú
          </button>
          <h1 id="messages-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
            Mensajes y transformación para el receptor
          </h1>
          <p className="mt-1 text-sm text-[#555555]">
            Tú envías desde tu modo ({MODE_METADATA[mode].label}) y Lumi transforma automáticamente el mensaje para el modo de accesibilidad de quien lo recibe.
          </p>
        </div>
      </div>

      {mode === 'ciego' && !alternativeControls && (
        <div className="rounded-2xl border border-[#E9E5D9] bg-[#FFF9E9] p-4 text-sm text-[#202020]">
          Estás en modo Ciego: puedes dictar con el micrófono y escuchar cada mensaje y su adaptación para el receptor.
        </div>
      )}

      {/* Guía de comandos por voz unificados */}
      <div className="rounded-2xl border border-[#D9BF68] bg-[#FFF9E9] px-4 py-3 text-xs text-[#202020]">
        <strong className="text-[#7D6618]">Comandos de voz continuos activos en Mensajes y Salas:</strong>{' '}
        di <em>&ldquo;Abrir sala&rdquo;</em>, <em>&ldquo;Unirse a sala LUMI 942&rdquo;</em>,{' '}
        <em>&ldquo;Hablar con Diego&rdquo;</em>, <em>&ldquo;Enviar ...&rdquo;</em>,{' '}
        <em>&ldquo;Salir de sala&rdquo;</em> o <em>&ldquo;Colgar&rdquo;</em>.
      </div>

      {/* Selector Chats vs Sala en vivo / Llamada */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Modos de mensajería">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chats'}
          onClick={() => setActiveTab('chats')}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${
            activeTab === 'chats'
              ? 'border-[#EE7A13] bg-[#F5DF91] text-[#202020]'
              : 'border-[#E9E5D9] bg-white text-[#555555] hover:border-[#EE7A13]/40 hover:bg-[#F7F5EE]'
          }`}
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          Chats por contacto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sala'}
          onClick={() => setActiveTab('sala')}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${
            activeTab === 'sala'
              ? 'border-[#EE7A13] bg-[#F5DF91] text-[#202020]'
              : 'border-[#E9E5D9] bg-white text-[#555555] hover:border-[#EE7A13]/40 hover:bg-[#F7F5EE]'
          }`}
        >
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
          Sala en vivo y Llamada (Audio + Subtítulos)
        </button>
      </div>

      {activeTab === 'sala' ? (
        <LiveRoomPanel
          mode={mode}
          userName={userName}
          roomCode={roomCode}
          onRoomCodeChange={setRoomCode}
          onLeaveRoom={() => setActiveTab('chats')}
          registerRoomVoiceHandler={(handler) => {
            roomVoiceHandlerRef.current = handler;
          }}
          autoStartAudioRecord={autoStartAudioRecord}
          onAutoStartConsumed={() => setAutoStartAudioRecord(false)}
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Lista de conversaciones */}
        <aside className="rounded-2xl border border-[#E9E5D9] bg-white p-4 lg:col-span-4">
          <div className="flex items-center justify-between gap-2 pb-3">
            <h2 className="text-base font-bold text-[#202020]">Receptores</h2>
            <button
              type="button"
              onClick={() => setShowAddContact((v) => !v)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E9E5D9] px-3 py-1.5 text-xs font-semibold text-[#202020] hover:bg-[#F7F5EE]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Nuevo contacto
            </button>
          </div>

          {showAddContact && (
            <form onSubmit={handleAddContact} className="mb-4 space-y-2 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] p-3">
              <div>
                <label htmlFor="new-contact-name" className="block text-xs font-semibold text-[#202020]">
                  Nombre del contacto
                </label>
                <input
                  id="new-contact-name"
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Ej. Lucía"
                  className="mt-1 min-h-[42px] w-full rounded-xl border border-[#D8D3C5] bg-white px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="new-contact-mode" className="block text-xs font-semibold text-[#202020]">
                  Modo en que recibe mensajes
                </label>
                <select
                  id="new-contact-mode"
                  value={newContactMode}
                  onChange={(e) => setNewContactMode(e.target.value as AccessibilityMode)}
                  className="mt-1 min-h-[42px] w-full rounded-xl border border-[#D8D3C5] bg-white px-3 text-sm"
                >
                  <option value="ciego">CIEGO (Audio y LumiCube)</option>
                  <option value="sordo">SORDO (Visual, Señas y Pictogramas)</option>
                  <option value="mudo">MUDO (Texto y respuesta por voz)</option>
                  <option value="general">GENERAL (Multimodal)</option>
                </select>
              </div>
              <button
                type="submit"
                className="min-h-[42px] w-full rounded-xl bg-[#F5DF91] px-3 text-sm font-bold text-[#202020]"
              >
                Guardar contacto
              </button>
            </form>
          )}

          {loading ? (
            <p className="py-6 text-sm text-[#555555]">Cargando conversaciones...</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((contact) => {
                const selected = contact.id === activeContactId;
  return (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => setActiveContactId(contact.id)}
                      className={`w-full rounded-xl border p-3.5 text-left ${
                        selected
                          ? 'border-[#D9BF68] bg-[#FFF9E9]'
                          : 'border-[#E9E5D9] bg-white hover:bg-[#FDFBF6]'
                      }`}
                    >
                      <div className="font-semibold text-[#202020]">{contact.name}</div>
                      <div className="mt-0.5 text-xs text-[#555555]">
                        Receptor: {MODE_METADATA[contact.recipientMode ?? 'general'].label} · {contact.preferredChannel}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Hilo activo + motor de transformación */}
        <div className="flex flex-col rounded-2xl border border-[#E9E5D9] bg-white p-4 sm:p-5 lg:col-span-8">
          {/* Barra superior de la conversación */}
          <div className="flex flex-col gap-3 border-b border-[#E9E5D9] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#202020]">
                {activeContact?.name ?? 'Conversación'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#555555]">
                <label htmlFor="recipient-mode-select" className="font-semibold text-[#202020]">
                  Modo del receptor:
                </label>
                <select
                  id="recipient-mode-select"
                  value={recipientMode}
                  onChange={(e) => handleChangeRecipientMode(e.target.value as AccessibilityMode)}
                  className="min-h-[36px] rounded-lg border border-[#D8D3C5] bg-[#FDFBF6] px-2.5 text-xs font-semibold text-[#202020]"
                >
                  <option value="ciego">Ciego (Audio y LumiCube)</option>
                  <option value="sordo">Sordo (Visual + Señas + Pictogramas)</option>
                  <option value="mudo">Mudo (Texto + Respuesta hablada)</option>
                  <option value="general">General (Multimodal)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setPerspective((p) => (p === 'sender' ? 'recipient' : 'sender'))
                }
                aria-pressed={perspective === 'recipient'}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold ${
                  perspective === 'recipient'
                    ? 'border-[#D9BF68] bg-[#FFF9E9] text-[#202020]'
                    : 'border-[#E9E5D9] bg-white text-[#202020] hover:bg-[#F7F5EE]'
                }`}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {perspective === 'recipient'
                  ? 'Viendo como receptor'
                  : 'Simular vista del receptor'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const summary = threadMessages
                    .slice(-3)
                    .map((m) => m.transformed?.audioScript || `${m.senderName} dice: ${m.text}`)
                    .join('. ');
                  speakWithBestVoice(summary || 'No hay mensajes en esta conversación todavía.');
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3 py-2 text-xs font-semibold text-[#202020]"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Escuchar hilo
              </button>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div
            className="my-4 max-h-[380px] flex-1 space-y-4 overflow-y-auto pr-1"
            aria-live="polite"
            data-testid="messages-thread"
          >
            {threadMessages.length === 0 ? (
              <div className="rounded-xl bg-[#F7F5EE] p-5 text-center text-sm text-[#555555]">
                Aún no hay mensajes con {activeContact?.name}. Escribe abajo para ver cómo se transforma para este receptor.
              </div>
            ) : (
              threadMessages.map((msg) => {
                const isMe = msg.sender === 'me';
                const payload =
                  msg.transformed ??
                  transformMessageForRecipient(msg.text, mode, recipientMode);

  return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      perspective === 'recipient'
                        ? 'items-start'
                        : isMe
                          ? 'items-end'
                          : 'items-start'
                    }`}
                  >
                    <div
                      className={`w-full max-w-[92%] rounded-2xl border p-4 ${
                        isMe
                          ? 'border-[#D9BF68] bg-[#FFF9E9]/70 text-[#202020]'
                          : 'border-[#E9E5D9] bg-[#F7F5EE] text-[#202020]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#555555]">
                        <div>
                          <strong className="font-semibold text-[#202020]">
                            {msg.senderName}
                          </strong>
                          <span aria-hidden="true"> · </span>
                          <span>{msg.modality}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => speakWithBestVoice(payload.audioScript || msg.text)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#202020] ring-1 ring-[#E9E5D9]"
                        >
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Escuchar
                        </button>
                      </div>

                      {perspective === 'sender' && (
                        <p className="mt-2 text-sm font-medium leading-relaxed text-[#202020]">
                          {msg.text}
                        </p>
                      )}

                      {/* Bloque de transformación para el receptor */}
                      <div className="mt-3 rounded-xl border border-[#E9E5D9] bg-white p-3.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7A611B]">
                          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{payload.modeLabel}</span>
                        </div>

                        <p className="mt-1.5 whitespace-pre-line text-sm font-semibold text-[#202020]">
                          {payload.adaptedText}
                        </p>

                        {payload.pictograms.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {payload.pictograms.map((p, idx) => (
                              <span
                                key={`${p.label}-${idx}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#FDFBF6] px-2.5 py-1 text-xs font-semibold text-[#202020] ring-1 ring-[#E9E5D9]"
                              >
                                <span aria-hidden="true">{p.symbol}</span>
                                <span>{p.label}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {payload.signGloss.length > 0 && (
                          <div className="mt-2.5 text-xs text-[#444444]">
                            <strong className="text-[#202020]">Glosa de señas: </strong>
                            {payload.signGloss.map((s) => s.gloss).join(' · ')}
                          </div>
                        )}

                        <p className="mt-2 text-xs text-[#555555]">{payload.tactileCue}</p>

                        {perspective === 'recipient' && payload.suggestedReplies.length > 0 && (
                          <div className="mt-3 border-t border-[#F0ECE1] pt-2.5">
                            <p className="mb-1.5 text-xs font-semibold text-[#555555]">
                              Responder como receptor (toca para hablar o enviar):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {payload.suggestedReplies.map((reply) => (
                                <button
                                  key={reply}
                                  type="button"
                                  onClick={() => {
                                    speakWithBestVoice(reply);
                                    setDraft(reply);
                                  }}
                                  className="min-h-[36px] rounded-lg border border-[#D9BF68] bg-[#FFF9E9] px-2.5 py-1 text-xs font-semibold text-[#202020]"
                                >
                                  {reply}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Vista previa en vivo de la transformación */}
          <div
            className="rounded-xl border border-[#E9E5D9] bg-[#FFF9E9] p-3.5"
            data-testid="live-transform-preview"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#7A611B]">
              <span>
                Vista previa en tiempo real · {livePreview.modeLabel}
              </span>
              <span>{livePreview.adaptedHeadline}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm font-medium text-[#202020]">
              {livePreview.adaptedText}
            </p>
            {livePreview.signGloss.length > 0 && (
              <p className="mt-1 text-xs text-[#555555]">
                Señas clave: {livePreview.signGloss.map((s) => s.gloss).join(' · ')}
              </p>
            )}
          </div>

          {/* Frases rápidas */}
          <div className="mt-3 border-t border-[#E9E5D9] pt-3">
            <p className="mb-2 text-xs font-semibold text-[#555555]">
              Frases rápidas de un toque
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => handleSend(phrase, 'frase_rapida')}
                  disabled={sending}
                  className="min-h-[40px] rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3 py-1.5 text-xs font-medium text-[#202020] hover:border-[#D9BF68] hover:bg-[#FFF9E9]"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>

          {/* Compositor */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(draft, 'texto');
            }}
            className="mt-4 space-y-2.5"
          >
            <label htmlFor="message-composer" className="block text-sm font-semibold text-[#202020]">
              Escribe o dicta tu mensaje (Lumi lo adaptará al enviar)
            </label>
            <textarea
              id="message-composer"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe aquí (incluso con abreviaturas como xfa o q)..."
              className="w-full rounded-xl border border-[#D8D3C5] bg-white p-3.5 text-sm text-[#202020]"
            />

            {error && (
              <div role="alert" className="rounded-xl bg-[#FDF1F1] p-2.5 text-xs font-medium text-[#7D2828]">
                {error}
              </div>
            )}
            {feedback && !error && (
              <div role="status" className="flex items-center gap-1.5 text-xs font-medium text-[#1E5629]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {feedback}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDictate}
                  disabled={dictating}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-4 py-2 text-sm font-semibold text-[#202020] hover:border-[#EE7A13] hover:bg-[#F7F5EE]"
                >
                  <Mic className="h-4 w-4 text-[#EE7A13]" aria-hidden="true" />
                  {dictating ? 'Escuchando...' : 'Dictar'}
                </button>
                <button
                  type="button"
                  onClick={handleDictateAndSend}
                  disabled={dictating || sending}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#EE7A13]/50 bg-[#FFF9E9] px-4 py-2 text-sm font-semibold text-[#202020] hover:border-[#EE7A13]"
                >
                  <Mic className="h-4 w-4 text-[#EE7A13]" aria-hidden="true" />
                  Audio a texto y enviar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!draft.trim()) {
                      setError('Escribe un mensaje para escucharlo antes de enviarlo.');
                      return;
                    }
                    speakWithBestVoice(livePreview.audioScript);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-4 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  Escuchar borrador
                </button>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F5DF91] px-5 py-2.5 text-sm font-bold text-[#202020] hover:bg-[#EDD37A] disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {sending ? 'Transformando y enviando...' : 'Enviar y transformar'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </section>
  );
};
