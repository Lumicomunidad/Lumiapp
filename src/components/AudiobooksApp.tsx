import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  BookmarkCheck,
  FileUp,
  UserCheck,
} from 'lucide-react';
import type { Audiobook, AudiobookProgress } from '../types/lumi';
import { computeBookProgressPercent, formatDuration, normalizeVoice } from '../utils/lumiLogic';
import { fetchAudiobooks, saveAudiobookProgress } from '../utils/api';
import {
  getActiveVoiceLabel,
  getSpanishVoices,
  speakWithBestVoice,
  stopAllSpeech,
  type VoiceGender,
} from '../utils/speech';

const CUSTOM_BOOKS_STORAGE_KEY = 'lumi_custom_pdf_audiobooks_v1';

interface AudiobooksAppProps {
  onBack: () => void;
  externalCubeCommand?: { action: string; timestamp: number } | null;
  registerVoiceHandler?: (handler: ((transcript: string) => string | null) | null) => void;
}

export const AudiobooksApp: React.FC<AudiobooksAppProps> = ({
  onBack,
  externalCubeCommand,
  registerVoiceHandler,
}) => {
  const [books, setBooks] = useState<Audiobook[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, AudiobookProgress>>({});
  const [activeBookId, setActiveBookId] = useState('');
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('mujer');
  const [preferredVoiceName, setPreferredVoiceName] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>(() =>
    getSpanishVoices()
  );
  const [voiceEngine, setVoiceEngine] = useState<'gemini' | 'browser' | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncVoices = () => setAvailableVoices(getSpanishVoices());
    syncVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', syncVoices);
      return () => window.speechSynthesis.removeEventListener?.('voiceschanged', syncVoices);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchAudiobooks()
      .then((data) => {
        if (!mounted) return;
        let customBooks: Audiobook[] = [];
        try {
          const raw = localStorage.getItem(CUSTOM_BOOKS_STORAGE_KEY);
          if (raw) customBooks = JSON.parse(raw) as Audiobook[];
        } catch {
          customBooks = [];
        }
        const mergedBooks = [...customBooks, ...data.books];
        setBooks(mergedBooks);
        setProgressMap(data.progress);
        if (mergedBooks.length > 0) {
          const first = mergedBooks[0];
          setActiveBookId(first.id);
          const saved = data.progress[first.id];
          if (saved) {
            const idx = first.chapters.findIndex((c) => c.id === saved.chapterId);
            if (idx >= 0) setActiveChapterIdx(idx);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      stopAllSpeech();
    };
  }, []);

  const activeBook = books.find((b) => b.id === activeBookId) ?? books[0];
  const activeChapter = activeBook?.chapters[activeChapterIdx] ?? activeBook?.chapters[0];

  const handleSelectBook = (book: Audiobook) => {
    stopAllSpeech();
    setIsPlaying(false);
    setActiveBookId(book.id);
    const saved = progressMap[book.id];
    const idx = saved ? book.chapters.findIndex((c) => c.id === saved.chapterId) : 0;
    setActiveChapterIdx(idx >= 0 ? idx : 0);
    setStatusMessage(`Libro seleccionado: ${book.title}`);
  };

  const playSpecificChapter = async (
    book: Audiobook,
    chapterIdx: number,
    gender: VoiceGender = voiceGender,
    customVoiceName: string = preferredVoiceName
  ) => {
    const chapter = book.chapters[chapterIdx] ?? book.chapters[0];
    if (!chapter) return;
    setActiveBookId(book.id);
    setActiveChapterIdx(chapterIdx);
    setIsPlaying(true);
    setStatusMessage(`Reproduciendo ${book.title} — Capítulo ${chapter.number}: ${chapter.title}`);

    const savedRec = await saveAudiobookProgress({
      bookId: book.id,
      chapterId: chapter.id,
      positionPercent: 50,
    }).catch(() => null);
    if (savedRec) {
      setProgressMap((prev) => ({ ...prev, [book.id]: savedRec.progress }));
    }

    const engine = await speakWithBestVoice(`${chapter.title}. ${chapter.text}`, {
      preferGemini: true,
      rate: playbackRate === 1 ? 0.96 : playbackRate,
      voiceGender: gender,
      preferredVoiceName: customVoiceName || undefined,
      onEnd: () => {
        setIsPlaying(false);
        setStatusMessage('Capítulo finalizado.');
      },
    });
    setVoiceEngine(engine);
  };

  const handlePlayChapter = async () => {
    if (!activeBook || !activeChapter) return;
    await playSpecificChapter(activeBook, activeChapterIdx, voiceGender);
  };

  const handleUploadBookFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    setStatusMessage(`Procesando "${file.name}"...`);

    try {
      const chapters: Audiobook['chapters'] = [];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const maxPages = Math.min(pdf.numPages, 60);
        for (let p = 1; p <= maxPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const text = content.items
            .map((it) => ('str' in it ? it.str : ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (text) {
            chapters.push({
              id: `pdf-p-${p}`,
              number: chapters.length + 1,
              title: `Página ${p}`,
              durationSeconds: Math.max(20, Math.round(text.split(' ').length / 2.2)),
              text,
            });
          }
        }
      } else {
        const text = (await file.text()).trim();
        const chunks = text.match(/[\s\S]{1,1800}(?:\s|$)/g) ?? [text];
        chunks.forEach((chunk, idx) => {
          const clean = chunk.trim();
          if (clean) {
            chapters.push({
              id: `txt-c-${idx + 1}`,
              number: idx + 1,
              title: `Parte ${idx + 1}`,
              durationSeconds: Math.max(20, Math.round(clean.split(' ').length / 2.2)),
              text: clean,
            });
          }
        });
      }

      if (chapters.length === 0) {
        setStatusMessage('No se pudo extraer texto legible del archivo.');
        return;
      }

      const newBook: Audiobook = {
        id: `custom-${Date.now()}`,
        title: file.name.replace(/\.(pdf|txt)$/i, ''),
        author: 'Archivo subido por ti',
        category: 'Mi PDF / Documento',
        summary: `Documento accesible con ${chapters.length} secciones listas para escuchar.`,
        coverAccent: '#F5DF91',
        chapters,
      };

      setBooks((prev) => {
        const next = [newBook, ...prev];
        try {
          const customOnly = next.filter((b) => b.id.startsWith('custom-'));
          localStorage.setItem(CUSTOM_BOOKS_STORAGE_KEY, JSON.stringify(customOnly));
        } catch {
          // ignore quota
        }
        return next;
      });
      setActiveBookId(newBook.id);
      setActiveChapterIdx(0);
      setStatusMessage(`"${newBook.title}" agregado con ${chapters.length} secciones.`);
    } catch {
      setStatusMessage('Error al leer el PDF. Verifica que no esté protegido con contraseña.');
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStop = () => {
    stopAllSpeech();
    setIsPlaying(false);
    setStatusMessage('Reproducción detenida.');
  };

  const handlePrevChapter = () => {
    if (!activeBook) return;
    stopAllSpeech();
    setIsPlaying(false);
    setActiveChapterIdx((prev) => Math.max(0, prev - 1));
  };

  const handleNextChapter = () => {
    if (!activeBook) return;
    stopAllSpeech();
    setIsPlaying(false);
    setActiveChapterIdx((prev) => Math.min(activeBook.chapters.length - 1, prev + 1));
  };

  const handleBookmark = async () => {
    if (!activeBook || !activeChapter) return;
    const savedRec = await saveAudiobookProgress({
      bookId: activeBook.id,
      chapterId: activeChapter.id,
      positionPercent: 100,
    }).catch(() => null);
    if (savedRec) {
      setProgressMap((prev) => ({ ...prev, [activeBook.id]: savedRec.progress }));
      setStatusMessage(`Marcador guardado en "${activeChapter.title}".`);
    }
  };

  // Sincronización con comandos de voz continuos en Audiolibros
  useEffect(() => {
    if (!registerVoiceHandler) return;
    registerVoiceHandler((transcript: string) => {
      const norm = normalizeVoice(transcript);

      if (norm.includes('voz de hombre') || norm.includes('voz hombre') || norm.includes('hombre')) {
        setVoiceGender('hombre');
        setStatusMessage('Voz cambiada a Hombre.');
        return 'Voz de hombre activada para audiolibros.';
      }
      if (norm.includes('voz de mujer') || norm.includes('voz mujer') || norm.includes('mujer')) {
        setVoiceGender('mujer');
        setStatusMessage('Voz cambiada a Mujer.');
        return 'Voz de mujer activada para audiolibros.';
      }

      if (norm.includes('pausar') || norm === 'detener' || norm === 'para' || norm === 'parar') {
        handleStop();
        return '[SILENT] Lectura detenida.';
      }

      if (norm.includes('siguiente capitulo') || norm === 'siguiente') {
        handleNextChapter();
        return 'Pasando al siguiente capítulo.';
      }
      if (norm.includes('capitulo anterior') || norm === 'anterior') {
        handlePrevChapter();
        return 'Volviendo al capítulo anterior.';
      }

      // "leer el libro [nombre] capitulo [N]" o "leer un libro" o "leer capitulo [N]"
      if (norm.includes('leer')) {
        let targetBook = activeBook;
        for (const b of books) {
          if (norm.includes(normalizeVoice(b.title))) {
            targetBook = b;
            break;
          }
        }
        if (!targetBook && books.length > 0) targetBook = books[0];
        if (!targetBook) return 'No hay libros disponibles todavía.';

        const chapMatch = norm.match(/capitulo\s+(\d+)/);
        const chapIdx = chapMatch
          ? Math.min(targetBook.chapters.length - 1, Math.max(0, Number(chapMatch[1]) - 1))
          : targetBook.id === activeBook?.id
            ? activeChapterIdx
            : 0;

        playSpecificChapter(targetBook, chapIdx, voiceGender);
        return `[SILENT] Leyendo ${targetBook.title}, capítulo ${chapIdx + 1}.`;
      }

      return null;
    });

    return () => registerVoiceHandler(null);
  }, [registerVoiceHandler, books, activeBook, activeChapterIdx, voiceGender]);

  // Sincronización con los botones físicos simulados de LumiCube
  useEffect(() => {
    if (!externalCubeCommand || !activeBook) return;
    if (externalCubeCommand.action === 'play') {
      handlePlayChapter();
    } else if (externalCubeCommand.action === 'pause' || externalCubeCommand.action === 'stop') {
      handleStop();
    } else if (externalCubeCommand.action === 'prev') {
      handlePrevChapter();
    } else if (externalCubeCommand.action === 'next') {
      handleNextChapter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCubeCommand]);

  return (
    <section aria-labelledby="audiobooks-heading" className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => {
            stopAllSpeech();
            onBack();
          }}
          className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al menú
        </button>
        <h1 id="audiobooks-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
          Audiolibros accesibles
        </h1>
        <p className="mt-1 text-sm text-[#555555]">
          Escucha historias y guías con lectura sincronizada en pantalla y control desde tu LumiCube.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E9E5D9] bg-white p-6 text-sm text-[#555555]">
          Cargando biblioteca de audiolibros...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Catálogo */}
          <aside className="space-y-3 lg:col-span-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#202020]">Biblioteca disponible</h2>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleUploadBookFile}
                  className="hidden"
                  id="upload-pdf-book"
                />
                <button
                  type="button"
                  disabled={uploadingPdf}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#F5DF91] px-3 py-1.5 text-xs font-bold text-[#202020] hover:bg-[#EDD37A]"
                >
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  {uploadingPdf ? 'Cargando PDF...' : 'Subir PDF / TXT'}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {books.map((book) => {
                const selected = activeBook?.id === book.id;
                const prog = progressMap[book.id];
                const progIdx = prog
                  ? Math.max(0, book.chapters.findIndex((c) => c.id === prog.chapterId))
                  : 0;
                const percent = prog
                  ? computeBookProgressPercent(
                      progIdx,
                      book.chapters.length,
                      prog.positionPercent
                    )
                  : 0;
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => handleSelectBook(book)}
                    aria-pressed={selected}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      selected
                        ? 'border-[#D9BF68] bg-[#FFF9E9]'
                        : 'border-[#E9E5D9] bg-white hover:bg-[#FDFBF6]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-[#555555]">
                          {book.category} · {book.chapters.length} capítulos
                        </div>
                        <h3 className="mt-0.5 text-base font-bold text-[#202020]">
                          {book.title}
                        </h3>
                        <p className="text-xs text-[#555555]">{book.author}</p>
                      </div>
                      <BookOpen className="h-5 w-5 shrink-0 text-[#7A611B]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[#444444]">
                      {book.summary}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#202020] tabular-nums">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E9E5D9]">
                        <div
                          className="h-full bg-[#D9BF68]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span>{percent}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Reproductor y texto sincronizado */}
          {activeBook && activeChapter && (
            <div className="space-y-4 rounded-2xl border border-[#E9E5D9] bg-white p-5 lg:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E9E5D9] pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#7A611B]">
                    {activeBook.title} · Capítulo {activeChapter.number} de{' '}
                    {activeBook.chapters.length}
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold text-[#202020]">
                    {activeChapter.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#555555] tabular-nums">
                    Duración estimada: {formatDuration(activeChapter.durationSeconds)} ·{' '}
                    {voiceEngine === 'gemini'
                      ? `Voz Lumi HD (${voiceGender})`
                      : `Voz: ${getActiveVoiceLabel(voiceGender, preferredVoiceName || undefined)}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl border border-[#D8D3C5] bg-[#FFFDF8] p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceGender('mujer');
                        setPreferredVoiceName('');
                        if (isPlaying && activeBook) {
                          void playSpecificChapter(activeBook, activeChapterIdx, 'mujer', '');
                        }
                      }}
                      className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${
                        voiceGender === 'mujer'
                          ? 'border border-[#EE7A13] bg-[#F5DF91] text-[#202020]'
                          : 'text-[#555555] hover:text-[#202020]'
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Mujer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceGender('hombre');
                        setPreferredVoiceName('');
                        if (isPlaying && activeBook) {
                          void playSpecificChapter(activeBook, activeChapterIdx, 'hombre', '');
                        }
                      }}
                      className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${
                        voiceGender === 'hombre'
                          ? 'border border-[#EE7A13] bg-[#F5DF91] text-[#202020]'
                          : 'text-[#555555] hover:text-[#202020]'
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Hombre
                    </button>
                  </div>

                  {availableVoices.length > 0 && (
                    <select
                      aria-label="Seleccionar voz del navegador"
                      value={preferredVoiceName}
                      onChange={(e) => setPreferredVoiceName(e.target.value)}
                      className="min-h-[40px] max-w-[180px] rounded-xl border border-[#D8D3C5] bg-white px-2.5 text-xs font-semibold"
                    >
                      <option value="">Voz automática (natural)</option>
                      {availableVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <label htmlFor="speed-select" className="text-xs font-semibold text-[#555555]">
                    Velocidad
                  </label>
                  <select
                    id="speed-select"
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                    className="min-h-[40px] rounded-xl border border-[#D8D3C5] bg-white px-2.5 text-xs font-semibold tabular-nums"
                  >
                    <option value={0.85}>0.85x</option>
                    <option value={1}>1.0x</option>
                    <option value={1.25}>1.25x</option>
                  </select>
                </div>
              </div>

              {/* Controles grandes accesibles */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrevChapter}
                  disabled={activeChapterIdx === 0}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-4 text-sm font-semibold text-[#202020] disabled:opacity-40"
                >
                  <SkipBack className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </button>

                {!isPlaying ? (
                  <button
                    type="button"
                    onClick={handlePlayChapter}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#F5DF91] px-6 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Reproducir capítulo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#202020] px-6 text-sm font-bold text-white"
                  >
                    <Pause className="h-4 w-4" aria-hidden="true" />
                    Pausar lectura
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStop}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-4 text-sm font-semibold text-[#202020]"
                >
                  <Square className="h-4 w-4" aria-hidden="true" />
                  Detener
                </button>

                <button
                  type="button"
                  onClick={handleNextChapter}
                  disabled={activeChapterIdx >= activeBook.chapters.length - 1}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-white px-4 text-sm font-semibold text-[#202020] disabled:opacity-40"
                >
                  Siguiente
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={handleBookmark}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] px-4 text-sm font-semibold text-[#202020] hover:bg-[#FFF9E9]"
                >
                  <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                  Guardar progreso
                </button>
              </div>

              {statusMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl bg-[#FFF9E9] px-4 py-2.5 text-xs font-semibold text-[#202020]"
                >
                  {statusMessage}
                </div>
              )}

              {/* Texto del capítulo para lectura visual simultánea */}
              <div className="rounded-2xl border border-[#E9E5D9] bg-[#FDFBF6] p-5">
                <h3 className="text-xs font-semibold text-[#555555]">
                  Texto accesible del capítulo
                </h3>
                <p className="mt-2 text-base leading-relaxed text-[#202020]">
                  {activeChapter.text}
                </p>
              </div>

              {/* Lista de capítulos */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-[#202020]">Capítulos</h3>
                <div className="space-y-1.5">
                  {activeBook.chapters.map((cap, idx) => (
                    <button
                      key={cap.id}
                      type="button"
                      onClick={() => {
                        stopAllSpeech();
                        setIsPlaying(false);
                        setActiveChapterIdx(idx);
                      }}
                      className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border px-4 py-2 text-left text-sm ${
                        idx === activeChapterIdx
                          ? 'border-[#D9BF68] bg-[#FFF9E9] font-semibold text-[#202020]'
                          : 'border-[#E9E5D9] bg-white text-[#444444] hover:bg-[#FDFBF6]'
                      }`}
                    >
                      <span>
                        {cap.number}. {cap.title}
                      </span>
                      <span className="text-xs text-[#555555] tabular-nums">
                        {formatDuration(cap.durationSeconds)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
