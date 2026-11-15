import React, { useState } from 'react';
import { ArrowLeft, Search, Volume2, Hand } from 'lucide-react';
import type { SignEntry, SignPhraseStep } from '../types/lumi';
import {
  SIGN_DICTIONARY,
  decomposePhraseToSigns,
  normalizeVoice,
} from '../utils/lumiLogic';
import { analyzeSignPhrase } from '../utils/api';
import { speakWithBestVoice } from '../utils/speech';

interface SignLanguageAppProps {
  onBack: () => void;
  embedded?: boolean;
}

export const SignLanguageApp: React.FC<SignLanguageAppProps> = ({ onBack, embedded = false }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | SignEntry['category']>('all');
  const [activeSign, setActiveSign] = useState<SignEntry>(SIGN_DICTIONARY[0]);
  const [phraseInput, setPhraseInput] = useState('Hola, necesito ayuda gracias');
  const [phraseSteps, setPhraseSteps] = useState<SignPhraseStep[]>(() =>
    decomposePhraseToSigns('Hola, necesito ayuda gracias')
  );
  const [analyzing, setAnalyzing] = useState(false);

  const filteredSigns = SIGN_DICTIONARY.filter((entry) => {
    const matchesCat = category === 'all' || entry.category === category;
    const query = normalizeVoice(search);
    const matchesText =
      !query ||
      normalizeVoice(entry.word).includes(query) ||
      normalizeVoice(entry.handshape).includes(query);
    return matchesCat && matchesText;
  });

  const handleAnalyzePhrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phraseInput.trim()) return;
    setAnalyzing(true);
    try {
      const res = await analyzeSignPhrase(phraseInput.trim());
      if (res.steps.length > 0) {
        setPhraseSteps(res.steps);
      } else {
        setPhraseSteps(decomposePhraseToSigns(phraseInput));
      }
    } catch {
      setPhraseSteps(decomposePhraseToSigns(phraseInput));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <section
      id="senas-integrado"
      aria-labelledby="signs-heading"
      className={embedded ? 'space-y-6 border-t-2 border-[#E9E5D9] pt-8' : 'space-y-6'}
    >
      <div>
        {!embedded && (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al menú
          </button>
        )}
        <h2 id="signs-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
          Lengua de señas
        </h2>
        <p className="mt-1 text-sm text-[#555555]">
          Explora señas esenciales paso a paso y convierte frases cotidianas en secuencias visuales.
        </p>
      </div>

      {/* Conversor de frase a señas */}
      <div className="rounded-2xl border border-[#E9E5D9] bg-[#FFF9E9] p-5">
        <h2 className="text-lg font-bold text-[#202020]">
          Convierte una frase a secuencia de señas
        </h2>
        <form onSubmit={handleAnalyzePhrase} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="sign-phrase-input" className="sr-only">
            Frase para convertir a lengua de señas
          </label>
          <input
            id="sign-phrase-input"
            type="text"
            value={phraseInput}
            onChange={(e) => setPhraseInput(e.target.value)}
            placeholder="Ej. Buenos días, quiero agua por favor"
            className="min-h-[48px] flex-1 rounded-xl border border-[#D8D3C5] bg-white px-4 text-sm text-[#202020]"
          />
          <button
            type="submit"
            disabled={analyzing}
            className="min-h-[48px] shrink-0 rounded-xl bg-[#F5DF91] px-5 py-2.5 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
          >
            {analyzing ? 'Analizando...' : 'Descomponer en señas'}
          </button>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {phraseSteps.map((step, idx) => (
            <div
              key={`${step.gloss}-${idx}`}
              className="rounded-xl border border-[#E9E5D9] bg-white p-3.5"
            >
              <div className="text-xs font-semibold text-[#7A611B] tabular-nums">
                Paso {idx + 1}
              </div>
              <div className="mt-0.5 text-base font-bold text-[#202020]">{step.gloss}</div>
              <p className="mt-1 text-xs leading-relaxed text-[#555555]">{step.cue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Diccionario visual */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#555555]"
                aria-hidden="true"
              />
              <label htmlFor="sign-search" className="sr-only">
                Buscar seña
              </label>
              <input
                id="sign-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar palabra (ej. Gracias, Ayuda, Lumi)..."
                className="min-h-[46px] w-full rounded-xl border border-[#D8D3C5] bg-white pr-4 pl-10 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl bg-[#F7F5EE] p-1">
              {(
                [
                  ['all', 'Todas'],
                  ['saludos', 'Saludos'],
                  ['emergencia', 'Ayuda'],
                  ['cotidiano', 'Cotidiano'],
                  ['lumi', 'Lumi'],
                ] as const
              ).map(([catId, label]) => (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setCategory(catId)}
                  className={`min-h-[38px] rounded-lg px-3 py-1 text-xs font-semibold ${
                    category === catId
                      ? 'bg-white text-[#202020] shadow-xs'
                      : 'text-[#555555] hover:text-[#202020]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredSigns.map((entry) => {
              const selected = activeSign.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setActiveSign(entry)}
                  aria-pressed={selected}
                  className={`min-h-[108px] rounded-2xl border p-4 text-left ${
                    selected
                      ? 'border-[#D9BF68] bg-[#FFF9E9]'
                      : 'border-[#E9E5D9] bg-white hover:bg-[#FDFBF6]'
                  }`}
                >
                  <span className="block text-2xl" aria-hidden="true">
                    {entry.gestureIcon}
                  </span>
                  <strong className="mt-2 block text-sm font-bold text-[#202020]">
                    {entry.word}
                  </strong>
                  <span className="mt-0.5 block text-xs text-[#555555]">{entry.category}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalle visual de la seña */}
        <aside className="rounded-2xl border border-[#E9E5D9] bg-white p-5 lg:col-span-5">
          <div className="flex items-start justify-between gap-3 border-b border-[#E9E5D9] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF9E9] text-3xl">
                {activeSign.gestureIcon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#202020]">{activeSign.word}</h2>
                <p className="text-xs text-[#555555]">Categoría: {activeSign.category}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                speakWithBestVoice(
                  `${activeSign.word}. Forma de la mano: ${activeSign.handshape}. Ubicación: ${activeSign.location}. Movimiento: ${activeSign.movement}.`
                )
              }
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-3 py-2 text-xs font-semibold text-[#202020]"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Escuchar guía
            </button>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-[#FDFBF6] p-3.5">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-[#555555]">
                <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                Configuración de mano
              </dt>
              <dd className="mt-1 font-medium text-[#202020]">{activeSign.handshape}</dd>
            </div>

            <div className="rounded-xl bg-[#FDFBF6] p-3.5">
              <dt className="text-xs font-semibold text-[#555555]">
                Ubicación
              </dt>
              <dd className="mt-1 font-medium text-[#202020]">{activeSign.location}</dd>
            </div>

            <div className="rounded-xl bg-[#FDFBF6] p-3.5">
              <dt className="text-xs font-semibold text-[#555555]">
                Movimiento
              </dt>
              <dd className="mt-1 font-medium text-[#202020]">{activeSign.movement}</dd>
            </div>

            <div className="rounded-xl bg-[#FFF9E9] p-3.5">
              <dt className="text-xs font-semibold text-[#7A611B]">
                Expresión facial
              </dt>
              <dd className="mt-1 font-medium text-[#202020]">{activeSign.expression}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
};
