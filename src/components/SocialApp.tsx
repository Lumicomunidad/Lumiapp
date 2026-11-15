import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Volume2,
  Send,
  Video,
  Mic,
  Upload,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import type { AccessibilityMode, SocialPost } from '../types/lumi';
import { MODE_METADATA, validateNonEmptyText } from '../utils/lumiLogic';
import {
  addSocialComment,
  createSocialPost,
  fetchSocialPosts,
  toggleLikeSocialPost,
  transcribeMediaWithGemini,
} from '../utils/api';
import {
  isSpeechRecognitionSupported,
  speakWithBestVoice,
  startContinuousVoiceCommandListener,
  startSingleSpeechCapture,
} from '../utils/speech';

interface SocialAppProps {
  mode: AccessibilityMode;
  authorName: string;
  onBack: () => void;
}

const CATEGORY_LABELS: Record<'all' | 'comunidad' | 'audio' | 'senas' | 'consejos', string> = {
  all: 'Todo',
  comunidad: 'Comunidad',
  audio: 'Audio-relatos',
  senas: 'Lengua de señas',
  consejos: 'Consejos Lumi',
};

export const SocialApp: React.FC<SocialAppProps> = ({ mode, authorName, onBack }) => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [filter, setFilter] = useState<'all' | 'comunidad' | 'audio' | 'senas' | 'consejos'>('all');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'comunidad' | 'audio' | 'senas' | 'consejos'>('comunidad');
  const [altDescription, setAltDescription] = useState('');
  const [videoDataUrl, setVideoDataUrl] = useState('');
  const [videoMimeType, setVideoMimeType] = useState('');
  const [videoTranscript, setVideoTranscript] = useState('');
  const [transcribingVideo, setTranscribingVideo] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState('');
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const liveSpeechRef = useRef<(() => void) | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      liveSpeechRef.current?.();
      videoRecorderRef.current?.stop();
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchSocialPosts()
      .then((data) => {
        if (mounted) setPosts(data.posts);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Error al cargar la red social.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visiblePosts =
    filter === 'all' ? posts : posts.filter((post) => post.category === filter);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Selecciona un archivo de video válido (MP4, WebM o MOV).');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('El video debe pesar máximo 12 MB para subirlo rápido.');
      return;
    }
    setError('');
    setVideoStatus(`Video cargado: ${file.name}. Puedes convertir su audio a palabras con IA o dictar subtítulos.`);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVideoDataUrl(reader.result);
        setVideoMimeType(file.type || 'video/mp4');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleTranscribeUploadedVideo = async () => {
    if (!videoDataUrl) return;
    const base64 = videoDataUrl.split(',')[1];
    if (!base64) return;
    setTranscribingVideo(true);
    setError('');
    setVideoStatus('Analizando el audio del video con Gemini IA...');
    try {
      const text = await transcribeMediaWithGemini(base64, videoMimeType || 'video/mp4');
      setVideoTranscript(text);
      setVideoStatus('Audio del video convertido a palabras.');
    } catch {
      setVideoStatus(
        'Para transcripción automática de archivos necesitas GEMINI_API_KEY activa en el servidor. También puedes usar "Dictar subtítulos" o escribirlos abajo.'
      );
    } finally {
      setTranscribingVideo(false);
    }
  };

  const handleDictateVideoTranscript = () => {
    if (!isSpeechRecognitionSupported()) {
      setVideoStatus('Tu navegador no soporta dictado; escribe los subtítulos manualmente.');
      return;
    }
    setVideoStatus('Escuchando para transcribir a palabras...');
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setVideoTranscript((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setVideoStatus('Palabras agregadas a los subtítulos del video.');
      },
      onError: (msg) => setVideoStatus(msg),
    });
  };

  const handleStartVideoRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no permite grabar video con cámara.');
      return;
    }
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      videoRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setVideoDataUrl(reader.result);
            setVideoMimeType(blob.type || 'video/webm');
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
        setRecordingVideo(false);
        setVideoStatus('Video grabado con palabras transcritas.');
      };

      // Transcribir en vivo lo que se habla mientras se graba el video
      if (isSpeechRecognitionSupported()) {
        liveSpeechRef.current = startContinuousVoiceCommandListener({
          onResult: (text) => {
            if (text.trim()) {
              setVideoTranscript((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
            }
          },
          onError: () => {},
        });
      }

      recorder.start(250);
      setRecordingVideo(true);
      setVideoStatus('Grabando video... lo que digas se transformará en palabras.');
    } catch {
      setError('No se pudo acceder a la cámara o micrófono para grabar video.');
    }
  };

  const handleStopVideoRecording = () => {
    liveSpeechRef.current?.();
    liveSpeechRef.current = null;
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.stop();
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const contentToSend =
      newContent.trim() ||
      (videoDataUrl ? videoTranscript.trim() || 'Video compartido en la comunidad Lumi' : '');
    const err = validateNonEmptyText(contentToSend, 3, 600);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setPublishing(true);
    try {
      const res = await createSocialPost({
        content: contentToSend,
        category: newCategory,
        altDescription: altDescription.trim() || undefined,
        authorName: authorName || 'Invitado Lumi',
        authorMode: mode,
        videoDataUrl: videoDataUrl || undefined,
        videoTranscript: videoTranscript.trim() || undefined,
      });
      setPosts((prev) => [res.post, ...prev]);
      setNewContent('');
      setAltDescription('');
      setVideoDataUrl('');
      setVideoMimeType('');
      setVideoTranscript('');
      setVideoStatus('');
      if (mode === 'ciego') {
        speakWithBestVoice('Tu publicación ya está en la comunidad Lumi.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar.');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const res = await toggleLikeSocialPost(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
    } catch {
      // Ignore transient like error
    }
  };

  const handleComment = async (postId: string) => {
    const text = (commentDrafts[postId] ?? '').trim();
    if (!text) return;
    try {
      const res = await addSocialComment(postId, text, authorName || 'Invitado Lumi');
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, res.comment] } : p
        )
      );
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    } catch {
      // Ignore error
    }
  };

  return (
    <section aria-labelledby="social-heading" className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al menú
        </button>
        <h1 id="social-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
          Red social accesible
        </h1>
        <p className="mt-1 text-sm text-[#555555]">
          Comparte experiencias, escucha publicaciones en voz alta y conversa sin barreras.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Formulario para publicar */}
        <aside className="lg:col-span-5">
          <form
            onSubmit={handlePublish}
            className="rounded-2xl border border-[#E9E5D9] bg-white p-5 space-y-4"
          >
            <h2 className="text-lg font-bold text-[#202020]">Compartir con la comunidad</h2>
            <div>
              <label htmlFor="post-category" className="block text-sm font-semibold text-[#202020]">
                Tema
              </label>
              <select
                id="post-category"
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as 'comunidad' | 'audio' | 'senas' | 'consejos')
                }
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[#D8D3C5] bg-white px-3 text-sm"
              >
                <option value="comunidad">Comunidad</option>
                <option value="audio">Audio-relatos</option>
                <option value="senas">Lengua de señas</option>
                <option value="consejos">Consejos Lumi</option>
              </select>
            </div>

            <div>
              <label htmlFor="post-content" className="block text-sm font-semibold text-[#202020]">
                ¿Qué quieres contar hoy?
              </label>
              <textarea
                id="post-content"
                rows={4}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Escribe una idea, un logro o un consejo accesible..."
                className="mt-1 w-full rounded-xl border border-[#D8D3C5] p-3.5 text-sm text-[#202020]"
              />
            </div>

            <div>
              <label htmlFor="post-alt" className="block text-xs font-semibold text-[#555555]">
                Resumen breve para lectores de pantalla (opcional)
              </label>
              <input
                id="post-alt"
                type="text"
                value={altDescription}
                onChange={(e) => setAltDescription(e.target.value)}
                placeholder="Ej. Consejo sobre lectura en voz alta"
                className="mt-1 min-h-[42px] w-full rounded-xl border border-[#D8D3C5] px-3 text-sm"
              />
            </div>

            {/* Video con audio transformado a palabras */}
            <div className="space-y-2.5 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#202020]">
                  <Video className="h-4 w-4 text-[#EE7A13]" aria-hidden="true" />
                  Video con audio en palabras
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#D8D3C5] bg-white px-2.5 py-1 text-xs font-semibold text-[#202020] hover:border-[#EE7A13]">
                    <Upload className="h-3.5 w-3.5 text-[#EE7A13]" aria-hidden="true" />
                    Subir video
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileChange}
                      className="sr-only"
                    />
                  </label>
                  {!recordingVideo ? (
                    <button
                      type="button"
                      onClick={handleStartVideoRecording}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D8D3C5] bg-white px-2.5 py-1 text-xs font-semibold text-[#202020] hover:border-[#EE7A13]"
                    >
                      <Video className="h-3.5 w-3.5 text-[#EE7A13]" aria-hidden="true" />
                      Grabar video
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopVideoRecording}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#B82525] px-2.5 py-1 text-xs font-bold text-white"
                    >
                      <Square className="h-3.5 w-3.5" aria-hidden="true" />
                      Detener grabación
                    </button>
                  )}
                </div>
              </div>

              {recordingVideo && (
                <video
                  ref={videoPreviewRef}
                  muted
                  playsInline
                  className="max-h-48 w-full rounded-lg bg-black object-cover"
                />
              )}

              {videoDataUrl && !recordingVideo && (
                <div className="space-y-2">
                  <video
                    src={videoDataUrl}
                    controls
                    playsInline
                    className="max-h-48 w-full rounded-lg bg-black"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={handleTranscribeUploadedVideo}
                      disabled={transcribingVideo}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#F5DF91] px-3 py-1 text-xs font-bold text-[#202020] hover:bg-[#EDD37A] disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#EE7A13]" aria-hidden="true" />
                      {transcribingVideo ? 'Transcribiendo...' : 'Audio a palabras (IA)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDictateVideoTranscript}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D8D3C5] bg-white px-2.5 py-1 text-xs font-semibold text-[#202020] hover:border-[#EE7A13]"
                    >
                      <Mic className="h-3.5 w-3.5 text-[#EE7A13]" aria-hidden="true" />
                      Dictar subtítulos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoDataUrl('');
                        setVideoMimeType('');
                        setVideoTranscript('');
                        setVideoStatus('');
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E5B8B8] bg-white px-2.5 py-1 text-xs font-semibold text-[#7D2828]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Quitar
                    </button>
                  </div>
                </div>
              )}

              {(videoDataUrl || recordingVideo || videoTranscript) && (
                <div>
                  <label htmlFor="video-transcript" className="block text-xs font-semibold text-[#202020]">
                    Audio transformado a palabras (subtítulos accesibles)
                  </label>
                  <textarea
                    id="video-transcript"
                    rows={2}
                    value={videoTranscript}
                    onChange={(e) => setVideoTranscript(e.target.value)}
                    placeholder="Aquí aparecerán las palabras habladas en el video..."
                    className="mt-1 w-full rounded-lg border border-[#D8D3C5] bg-white p-2.5 text-xs text-[#202020]"
                  />
                </div>
              )}

              {videoStatus && (
                <p className="text-xs font-medium text-[#6B5D3B]" aria-live="polite">
                  {videoStatus}
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-[#FDF1F1] p-3 text-xs font-medium text-[#7D2828]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={publishing}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#F5DF91] px-5 py-3 text-sm font-bold text-[#202020] hover:bg-[#EDD37A] disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {publishing ? 'Publicando...' : 'Publicar en Lumi'}
            </button>
          </form>
        </aside>

        {/* Muro social */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-[#F7F5EE] p-1.5" role="tablist" aria-label="Filtrar publicaciones">
            {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={filter === cat}
                onClick={() => setFilter(cat)}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  filter === cat
                    ? 'border-b-2 border-[#EE7A13] bg-white text-[#202020] shadow-xs'
                    : 'text-[#555555] hover:text-[#202020]'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[#E9E5D9] bg-white p-6 text-sm text-[#555555]">
              Cargando publicaciones de la comunidad...
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="rounded-2xl border border-[#E9E5D9] bg-white p-6 text-sm text-[#555555]">
              No hay publicaciones en esta categoría todavía. ¡Sé la primera persona en compartir!
            </div>
          ) : (
            <div className="space-y-4" data-testid="social-feed">
              {visiblePosts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-[#E9E5D9] bg-white p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#555555]">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-bold text-[#202020]">
                        {post.authorName}
                      </strong>
                      <span aria-hidden="true">·</span>
                      <span>{MODE_METADATA[post.authorMode]?.shortLabel ?? 'Modo general'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{CATEGORY_LABELS[post.category]}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        speakWithBestVoice(
                          `${post.authorName} escribió: ${post.content}${
                            post.videoTranscript
                              ? `. Subtítulos del video: ${post.videoTranscript}`
                              : ''
                          }`
                        )
                      }
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#E9E5D9] bg-[#FDFBF6] px-3 py-1 text-xs font-semibold text-[#202020] hover:border-[#EE7A13] hover:bg-[#FFF9E9]"
                    >
                      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Escuchar
                    </button>
                  </div>

                  <p className="mt-3 text-base leading-relaxed text-[#202020]">
                    {post.content}
                  </p>
                  {post.videoDataUrl && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-[#E9E5D9] bg-black">
                      <video
                        src={post.videoDataUrl}
                        controls
                        playsInline
                        className="max-h-80 w-full"
                      />
                    </div>
                  )}
                  {post.videoTranscript && (
                    <div className="mt-2.5 rounded-xl border border-[#EE7A13]/35 bg-[#FFF9E9] px-3.5 py-2.5 text-sm text-[#202020]">
                      <strong className="block text-xs font-bold text-[#B85706]">
                        Audio del video en palabras (subtítulos):
                      </strong>
                      <p className="mt-0.5 leading-relaxed">{post.videoTranscript}</p>
                    </div>
                  )}
                  {post.altDescription && (
                    <p className="mt-2 text-xs text-[#555555]">
                      Contexto accesible: {post.altDescription}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-4 border-t border-[#F0ECE1] pt-3">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      aria-pressed={post.likedByUser}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                        post.likedByUser
                          ? 'bg-[#FFF9E9] text-[#202020] ring-1 ring-[#D9BF68]'
                          : 'bg-[#F7F5EE] text-[#555555] hover:text-[#202020]'
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${post.likedByUser ? 'fill-[#D9BF68] text-[#9A7B1B]' : ''}`}
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">{post.likes}</span> Me gusta
                    </button>

                    <span className="inline-flex items-center gap-1.5 text-xs text-[#555555]">
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      <span className="tabular-nums">{post.comments.length}</span> comentarios
                    </span>
                  </div>

                  {/* Comentarios */}
                  {post.comments.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-[#F5F2E9] pt-3">
                      {post.comments.map((cm) => (
                        <li key={cm.id} className="rounded-xl bg-[#FDFBF6] px-3.5 py-2.5 text-sm">
                          <strong className="font-semibold text-[#202020]">{cm.authorName}: </strong>
                          <span className="text-[#333333]">{cm.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleComment(post.id);
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <label htmlFor={`comment-${post.id}`} className="sr-only">
                      Responder a {post.authorName}
                    </label>
                    <input
                      id={`comment-${post.id}`}
                      type="text"
                      value={commentDrafts[post.id] ?? ''}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Escribe un comentario amable..."
                      className="min-h-[42px] flex-1 rounded-xl border border-[#D8D3C5] px-3 text-sm"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] rounded-xl bg-[#F1EFEA] px-4 text-xs font-semibold text-[#202020] hover:bg-[#F5DF91]"
                    >
                      Responder
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
