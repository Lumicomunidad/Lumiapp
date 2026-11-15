import React, { useState } from 'react';
import { ArrowLeft, Mic, RefreshCw, Volume2 } from 'lucide-react';
import type { TranslationResult, TranslationTarget } from '../types/lumi';
import {
  buildLocalAccessibleTranslation,
  validateNonEmptyText,
} from '../utils/lumiLogic';
import { translateCommunication } from '../utils/api';
import {
  isSpeechRecognitionSupported,
  speakWithBestVoice,
  startSingleSpeechCapture,
} from '../utils/speech';
import { SignLanguageApp } from './SignLanguageApp';

interface TranslatorAppProps {
  onBack: () => void;
}

const TARGET_OPTIONS: Array<{ id: TranslationTarget; label: string; description: string }> = [
  {
    id: 'lectura_facil',
    label: 'Lectura fácil',
    description: 'Frases cortas, directas y simples',
  },
  {
    id: 'senas_glosa',
    label: 'Lengua de señas (Glosa)',
    description: 'Orden visual en mayúsculas y pasos de señas',
  },
  {
    id: 'pictogramas',
    label: 'Pictogramas',
    description: 'Secuencia de símbolos e ideas clave',
  },
  {
    id: 'en',
    label: 'Inglés accesible',
    description: 'Traducción clara al inglés',
  },
  {
    id: 'pt',
    label: 'Portugués accesible',
    description: 'Traducción clara al portugués',
  },
];

export const TranslatorApp: React.FC<TranslatorAppProps> = ({ onBack }) => {
  const [sourceText, setSourceText] = useState(
    'Necesito ayuda para llegar a la estación de metro más cercana, por favor.'
  );
  const [target, setTarget] = useState<TranslationTarget>('lectura_facil');
  const [result, setResult] = useState<TranslationResult | null>(() =>
    buildLocalAccessibleTranslation(
      'Necesito ayuda para llegar a la estación de metro más cercana, por favor.',
      'lectura_facil'
    )
  );
  const [loading, setLoading] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [error, setError] = useState('');

  const handleTranslate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const validationErr = validateNonEmptyText(sourceText, 1, 800);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const apiRes = await translateCommunication({
        text: sourceText.trim(),
        target,
      });
      setResult(apiRes);
    } catch {
      // Fallback determinista para mantener disponibilidad sin clave Gemini
      setResult(buildLocalAccessibleTranslation(sourceText.trim(), target));
    } finally {
      setLoading(false);
    }
  };

  const handleDictate = () => {
    if (!isSpeechRecognitionSupported()) {
      setError('El dictado por voz requiere Google Chrome o Microsoft Edge.');
      return;
    }
    setDictating(true);
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setDictating(false);
        setSourceText(transcript);
      },
      onError: (msg) => {
        setDictating(false);
        setError(msg);
      },
      onEnd: () => setDictating(false),
    });
  };

  return (
    <section aria-labelledby="translator-heading" className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al menú
        </button>
        <h1 id="translator-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
          Traductor de comunicación
        </h1>
        <p className="mt-1 text-sm text-[#555555]">
          Convierte cualquier mensaje entre voz, texto claro, glosa de señas, pictogramas o idiomas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleTranslate}
          className="space-y-4 rounded-2xl border border-[#E9E5D9] bg-white p-5 lg:col-span-6"
        >
          <div>
            <label htmlFor="translator-input" className="block text-sm font-semibold text-[#202020]">
              Mensaje original
            </label>
            <textarea
              id="translator-input"
              rows={4}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Escribe o dicta lo que deseas transformar..."
              className="mt-1.5 w-full rounded-xl border border-[#D8D3C5] p-3.5 text-sm text-[#202020]"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[#202020]">Formato de salida</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TARGET_OPTIONS.map((opt) => {
                const selected = target === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTarget(opt.id)}
                    aria-pressed={selected}
                    className={`min-h-[54px] rounded-xl border p-3 text-left ${
                      selected
                        ? 'border-[#D9BF68] bg-[#FFF9E9]'
                        : 'border-[#E9E5D9] bg-white hover:bg-[#FDFBF6]'
                    }`}
                  >
                    <div className="text-sm font-bold text-[#202020]">{opt.label}</div>
                    <div className="text-xs text-[#555555]">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-[#FDF1F1] p-3 text-xs font-medium text-[#7D2828]">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleDictate}
              disabled={dictating}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-4 py-2 text-sm font-semibold text-[#202020]"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              {dictating ? 'Escuchando...' : 'Dictar frase'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F5DF91] px-6 py-2.5 text-sm font-bold text-[#202020] hover:bg-[#EDD37A] disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {loading ? 'Adaptando...' : 'Traducir'}
            </button>
          </div>
        </form>

        <div
          className="rounded-2xl border border-[#E9E5D9] bg-[#FFF9E9] p-5 lg:col-span-6"
          aria-live="polite"
        >
          {result ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E9E5D9] pb-3">
                <h2 className="text-lg font-bold text-[#202020]">{result.headline}</h2>
                <button
                  type="button"
                  onClick={() => speakWithBestVoice(result.adaptedText)}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#D9BF68] bg-white px-3.5 py-2 text-xs font-semibold text-[#202020]"
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  Escuchar resultado
                </button>
              </div>

              <div className="whitespace-pre-line rounded-xl border border-[#E9E5D9] bg-white p-4 text-base font-medium leading-relaxed text-[#202020]">
                {result.adaptedText}
              </div>

              {result.pictograms.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#555555]">
                    Conceptos visuales
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {result.pictograms.map((pic, idx) => (
                      <div
                        key={`${pic.label}-${idx}`}
                        className="rounded-xl border border-[#E9E5D9] bg-white p-3 text-center"
                      >
                        <div className="text-2xl" aria-hidden="true">
                          {pic.symbol}
                        </div>
                        <div className="mt-1 text-xs font-bold text-[#202020]">
                          {pic.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.steps.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#555555]">
                    Guía de comunicación
                  </p>
                  <ul className="space-y-1.5 text-sm text-[#333333]">
                    {result.steps.map((stepText, idx) => (
                      <li key={idx} className="rounded-lg bg-white/80 px-3 py-2">
                        {stepText}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#555555]">
              Escribe un mensaje y presiona Traducir para ver el resultado adaptado.
            </p>
          )}
        </div>
      </div>

      {/* Lengua de señas integrada debajo del traductor */}
      <SignLanguageApp embedded onBack={onBack} />
    </section>
  );
};
