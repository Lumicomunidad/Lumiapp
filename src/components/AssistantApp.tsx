import React, { useState } from 'react';
import { ArrowLeft, Mic, Send, Volume2, ArrowRight } from 'lucide-react';
import type { AccessibilityMode, AppSectionId, AssistantTurn } from '../types/lumi';
import { MODE_METADATA } from '../utils/lumiLogic';
import { askLumiAssistant } from '../utils/api';
import {
  isSpeechRecognitionSupported,
  speakWithBestVoice,
  startSingleSpeechCapture,
} from '../utils/speech';

interface AssistantAppProps {
  mode: AccessibilityMode;
  userName: string;
  onBack: () => void;
  onNavigate: (section: AppSectionId) => void;
}

const STARTER_PROMPTS = [
  '¿Cómo funciona el Teléfono Cubo con Lumi?',
  'Ayúdame a redactar un mensaje amable para pedir ayuda en la calle.',
  '¿Qué audiolibros me recomiendas escuchar hoy?',
  'Explícame cómo usar el modo actual sin complicaciones.',
];

export const AssistantApp: React.FC<AssistantAppProps> = ({
  mode,
  userName,
  onBack,
  onNavigate,
}) => {
  const [turns, setTurns] = useState<AssistantTurn[]>([
    {
      id: 'init-1',
      role: 'assistant',
      text: `Hola${userName ? ` ${userName}` : ''}, soy Lumi. Estoy configurado para apoyarte en el ${MODE_METADATA[mode].summary.toLowerCase()}. ¿En qué te ayudo hoy?`,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(mode === 'ciego');
  const [error, setError] = useState('');

  const sectionLabels: Record<AppSectionId, string> = {
    home: 'Menú principal',
    mensajes: 'Ir a Mensajes',
    social: 'Ir a Red social',
    traductor: 'Ir al Traductor y Señas',
    senas: 'Ir a Lengua de señas',
    calendario: 'Ir al Calendario y Recordatorios',
    certificados: 'Ir a Certificados y Ayudas',
    asistente: 'Asistente Lumi',
    audiolibros: 'Ir a Audiolibros',
    lumicube: 'Explorar LumiCube',
  };

  const handleAsk = async (questionText: string) => {
    const clean = questionText.trim();
    if (!clean) {
      setError('Escribe o dicta tu consulta para Lumi.');
      return;
    }
    setError('');
    const userTurn: AssistantTurn = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: clean,
      createdAt: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    setLoading(true);

    try {
      const res = await askLumiAssistant({
        message: clean,
        mode,
        userName,
        history: turns.map((t) => ({ role: t.role, text: t.text })),
      });
      const suggestedSection = res.suggestedSection as AppSectionId | null;
      const assistantTurn: AssistantTurn = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        suggestedAction: suggestedSection
          ? {
              label: sectionLabels[suggestedSection] ?? 'Abrir sección',
              section: suggestedSection,
            }
          : undefined,
        createdAt: new Date().toISOString(),
      };
      setTurns((prev) => [...prev, assistantTurn]);
      if (autoSpeak) {
        speakWithBestVoice(res.reply, { preferGemini: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude responder ahora.');
    } finally {
      setLoading(false);
    }
  };

  const handleDictate = () => {
    if (!isSpeechRecognitionSupported()) {
      setError('El dictado por voz requiere Chrome o Edge.');
      return;
    }
    setDictating(true);
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setDictating(false);
        setInput(transcript);
      },
      onError: (msg) => {
        setDictating(false);
        setError(msg);
      },
      onEnd: () => setDictating(false),
    });
  };

  return (
    <section aria-labelledby="assistant-heading" className="space-y-6">
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
          <h1 id="assistant-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
            Asistente Lumi
          </h1>
          <p className="mt-1 text-sm text-[#555555]">
            Orientación inteligente adaptada a tu modo ({MODE_METADATA[mode].label}).
          </p>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-[#E9E5D9] bg-white px-4 py-2 text-sm font-medium text-[#202020]">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(e) => setAutoSpeak(e.target.checked)}
            className="h-4 w-4 accent-[#C6A73E]"
          />
          <span>Leer respuestas en voz alta</span>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sugerencias rápidas */}
        <aside className="space-y-3 rounded-2xl border border-[#E9E5D9] bg-[#FFF9E9] p-5 lg:col-span-4">
          <h2 className="text-base font-bold text-[#202020]">Preguntas rápidas</h2>
          <div className="space-y-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleAsk(prompt)}
                disabled={loading}
                className="w-full rounded-xl border border-[#E9E5D9] bg-white p-3 text-left text-xs font-medium leading-relaxed text-[#202020] hover:border-[#D9BF68]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </aside>

        {/* Conversación */}
        <div className="flex flex-col rounded-2xl border border-[#E9E5D9] bg-white p-5 lg:col-span-8">
          <div
            className="max-h-[380px] flex-1 space-y-3 overflow-y-auto pr-1"
            aria-live="polite"
            data-testid="assistant-messages"
          >
            {turns.map((turn) => {
              const isUser = turn.role === 'user';
              return (
                <div
                  key={turn.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl border px-4 py-3 ${
                      isUser
                        ? 'border-[#D9BF68] bg-[#FFF9E9] text-[#202020]'
                        : 'border-[#E9E5D9] bg-[#F7F5EE] text-[#202020]'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{turn.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => speakWithBestVoice(turn.text, { preferGemini: true })}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#202020] ring-1 ring-[#E9E5D9]"
                        >
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Escuchar
                        </button>
                      )}
                      {turn.suggestedAction && (
                        <button
                          type="button"
                          onClick={() => onNavigate(turn.suggestedAction!.section)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#F5DF91] px-3 py-1 text-xs font-bold text-[#202020]"
                        >
                          {turn.suggestedAction.label}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="rounded-xl bg-[#F7F5EE] px-4 py-3 text-sm text-[#555555]">
                Lumi está pensando una respuesta clara...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(input);
            }}
            className="mt-4 space-y-2 border-t border-[#E9E5D9] pt-4"
          >
            <label htmlFor="assistant-input" className="block text-sm font-semibold text-[#202020]">
              Pregúntale a Lumi
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="assistant-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe o dicta lo que necesitas..."
                className="min-h-[48px] flex-1 rounded-xl border border-[#D8D3C5] px-4 text-sm text-[#202020]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDictate}
                  disabled={dictating}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-4 text-sm font-semibold text-[#202020]"
                  aria-label="Dictar pregunta"
                >
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  {dictating ? '...' : 'Dictar'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F5DF91] px-5 text-sm font-bold text-[#202020] hover:bg-[#EDD37A] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Enviar
                </button>
              </div>
            </div>
            {error && (
              <div role="alert" className="rounded-xl bg-[#FDF1F1] p-2.5 text-xs text-[#7D2828]">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
};
