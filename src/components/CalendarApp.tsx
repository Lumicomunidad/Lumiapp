import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mic,
  Plus,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import type { AccessibilityMode, LumiReminder } from '../types/lumi';
import {
  REMINDER_STATUS_META,
  computeReminderStatus,
  getTodayDateString,
  parseReminderFromSpeech,
} from '../utils/reminders';
import {
  isSpeechRecognitionSupported,
  speakWithBestVoice,
  startSingleSpeechCapture,
} from '../utils/speech';

interface CalendarAppProps {
  mode: AccessibilityMode;
  reminders: LumiReminder[];
  onUpdateReminders: (next: LumiReminder[]) => void;
  registerVoiceHandler?: (handler: ((transcript: string) => string | null) | null) => void;
  onBack: () => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const CalendarApp: React.FC<CalendarAppProps> = ({
  mode,
  reminders,
  onUpdateReminders,
  registerVoiceHandler,
  onBack,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateString());
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'proximamente' | 'hoy' | 'finalizado'>('all');
  const [dictating, setDictating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!registerVoiceHandler) return;
    registerVoiceHandler((transcript: string) => {
      const parsed = parseReminderFromSpeech(transcript, new Date());
      if (!parsed) return null;

      const nowIso = new Date().toISOString();
      const status = computeReminderStatus(parsed.date, 'proximamente');
      const newItem: LumiReminder = {
        id: `rem-${Date.now()}`,
        title: parsed.title,
        date: parsed.date,
        time: parsed.time,
        status,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      onUpdateReminders([newItem, ...reminders]);
      setSelectedDate(parsed.date);
      return `Recordatorio agregado: ${parsed.title}, para el ${parsed.date} a las ${parsed.time}.`;
    });

    return () => registerVoiceHandler(null);
  }, [registerVoiceHandler, reminders, onUpdateReminders]);

  const formattedDate = useMemo(() => {
    return now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [now]);

  const formattedTime = useMemo(() => {
    return now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [now]);

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // Lunes = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(viewMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      cells.push({ day: d, dateStr: `${viewYear}-${m}-${dayStr}` });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handleSpeakClock = () => {
    speakWithBestVoice(`Hoy es ${formattedDate}, y son las ${formattedTime.slice(0, 5)}.`);
  };

  const handleDictateTitle = () => {
    if (!isSpeechRecognitionSupported()) {
      setError('El dictado por voz requiere Chrome o Edge actualizado.');
      return;
    }
    setError('');
    setDictating(true);
    startSingleSpeechCapture({
      onResult: (transcript) => {
        setDictating(false);
        setTitle(transcript);
      },
      onError: (msg) => {
        setDictating(false);
        setError(msg);
      },
      onEnd: () => setDictating(false),
    });
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Escribe o dicta un título para el recordatorio.');
      return;
    }
    setError('');
    const nowIso = new Date().toISOString();
    const status = computeReminderStatus(selectedDate, 'proximamente');
    const newItem: LumiReminder = {
      id: `rem-${Date.now()}`,
      title: cleanTitle,
      date: selectedDate,
      time: time || '09:00',
      note: note.trim() || undefined,
      status,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const next = [newItem, ...reminders];
    onUpdateReminders(next);
    setTitle('');
    setNote('');
    if (mode === 'ciego') {
      speakWithBestVoice(`Recordatorio guardado para ${selectedDate} a las ${time}: ${cleanTitle}`);
    }
  };

  const handleToggleFinish = (id: string) => {
    const next = reminders.map((r) => {
      if (r.id !== id) return r;
      const nextStatus =
        r.status === 'finalizado'
          ? computeReminderStatus(r.date, 'proximamente')
          : 'finalizado';
      return {
        ...r,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
    });
    onUpdateReminders(next);
  };

  const visibleReminders = useMemo(() => {
    return reminders
      .filter((r) => filterStatus === 'all' || r.status === filterStatus)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [reminders, filterStatus]);

  const counts = useMemo(() => {
    return {
      proximamente: reminders.filter((r) => r.status === 'proximamente').length,
      hoy: reminders.filter((r) => r.status === 'hoy').length,
      finalizado: reminders.filter((r) => r.status === 'finalizado').length,
    };
  }, [reminders]);

  const todayStr = getTodayDateString(now);

  return (
    <section aria-labelledby="calendar-heading" className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al menú
        </button>
        <h1 id="calendar-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
          Calendario y Recordatorios
        </h1>
        <p className="mt-1 text-sm text-[#555555]">
          Tus recordatorios nunca se borran: cambian de estado automáticamente entre{' '}
          <strong className="text-[#1E5629]">Próximamente (Verde)</strong>,{' '}
          <strong className="text-[#DC2626]">Hoy (Rojo)</strong> y{' '}
          <strong className="text-[#171717]">Finalizado (Negro)</strong>. A la hora exacta, Lumi te avisa.
        </p>
      </div>

      {/* Reloj y fecha en vivo */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#D9BF68] bg-[#FFF9E9] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7D6618]">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Hora y fecha actual
          </p>
          <p className="tabular-nums mt-1 text-3xl font-extrabold text-[#202020] sm:text-4xl">
            {formattedTime}
          </p>
          <p className="mt-0.5 text-sm font-medium capitalize text-[#555555]">
            {formattedDate}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSpeakClock}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F5DF91] px-4 py-2.5 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          Escuchar hora y fecha
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Calendario mensual completo */}
        <div className="rounded-2xl border border-[#E9E5D9] bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#202020]">
              <CalendarIcon className="h-5 w-5 text-[#7D6618]" aria-hidden="true" />
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear((y) => y - 1);
                  } else {
                    setViewMonth((m) => m - 1);
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9E5D9] hover:bg-[#F7F5EE]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear((y) => y + 1);
                  } else {
                    setViewMonth((m) => m + 1);
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9E5D9] hover:bg-[#F7F5EE]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#555555]">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="py-1.5">
                {wd}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.dateStr) {
                return <div key={`empty-${idx}`} className="h-12 rounded-xl bg-transparent" />;
              }
              const dayReminders = reminders.filter((r) => r.date === cell.dateStr);
              const isSelected = selectedDate === cell.dateStr;
              const isToday = todayStr === cell.dateStr;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr!)}
                  className={`flex h-12 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition ${
                    isSelected
                      ? 'border-[#8A6F1E] bg-[#F5DF91] text-[#202020] ring-2 ring-[#D9BF68]'
                      : isToday
                        ? 'border-[#DC2626] bg-[#FFF9E9] text-[#202020]'
                        : 'border-[#E9E5D9] bg-white text-[#202020] hover:bg-[#F7F5EE]'
                  }`}
                >
                  <span className="tabular-nums">{cell.day}</span>
                  {dayReminders.length > 0 && (
                    <span className="mt-0.5 flex items-center gap-0.5" aria-hidden="true">
                      {dayReminders.slice(0, 3).map((r) => (
                        <span
                          key={r.id}
                          className={`h-1.5 w-1.5 rounded-full ${REMINDER_STATUS_META[r.status].dotClass}`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Formulario agregar recordatorio */}
        <form
          onSubmit={handleAddReminder}
          className="space-y-4 rounded-2xl border border-[#E9E5D9] bg-[#FFFDF8] p-5 lg:col-span-5"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#202020]">
            <Plus className="h-5 w-5 text-[#7D6618]" aria-hidden="true" />
            Nuevo recordatorio
          </h2>

          <div>
            <label htmlFor="rem-title" className="block text-xs font-bold uppercase text-[#555555]">
              ¿Qué quieres recordar?
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="rem-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Tomar medicación o cita médica"
                className="min-h-[44px] w-full rounded-xl border border-[#E9E5D9] bg-white px-3 text-sm"
              />
              <button
                type="button"
                onClick={handleDictateTitle}
                title="Dictar por voz"
                aria-label="Dictar título por voz"
                className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border px-3 ${
                  dictating
                    ? 'border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]'
                    : 'border-[#E9E5D9] bg-white text-[#202020] hover:bg-[#F7F5EE]'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rem-date" className="block text-xs font-bold uppercase text-[#555555]">
                Fecha
              </label>
              <input
                id="rem-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[#E9E5D9] bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="rem-time" className="block text-xs font-bold uppercase text-[#555555]">
                Hora del aviso
              </label>
              <input
                id="rem-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-[#E9E5D9] bg-white px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rem-note" className="block text-xs font-bold uppercase text-[#555555]">
              Nota opcional
            </label>
            <textarea
              id="rem-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalles adicionales..."
              className="mt-1 w-full rounded-xl border border-[#E9E5D9] bg-white p-3 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#F5DF91] px-4 py-2.5 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            Guardar recordatorio
          </button>
        </form>
      </div>

      {/* Historial permanente de recordatorios (nunca se borran) */}
      <div className="space-y-4 rounded-2xl border border-[#E9E5D9] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#202020]">
            Historial de recordatorios ({reminders.length})
          </h2>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold ${
                filterStatus === 'all'
                  ? 'border-[#8A6F1E] bg-[#F5DF91] text-[#202020]'
                  : 'border-[#E9E5D9] bg-white text-[#555555]'
              }`}
            >
              Todos ({reminders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('proximamente')}
              className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold ${
                filterStatus === 'proximamente'
                  ? 'border-[#2E7D32] bg-[#EBF6ED] text-[#1E5629]'
                  : 'border-[#E9E5D9] bg-white text-[#1E5629]'
              }`}
            >
              Próximamente ({counts.proximamente})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('hoy')}
              className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold ${
                filterStatus === 'hoy'
                  ? 'border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]'
                  : 'border-[#E9E5D9] bg-white text-[#991B1B]'
              }`}
            >
              Hoy ({counts.hoy})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('finalizado')}
              className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold ${
                filterStatus === 'finalizado'
                  ? 'border-[#000000] bg-[#171717] text-white'
                  : 'border-[#E9E5D9] bg-white text-[#202020]'
              }`}
            >
              Finalizado ({counts.finalizado})
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {visibleReminders.map((rem) => {
            const meta = REMINDER_STATUS_META[rem.status];
            return (
              <article
                key={rem.id}
                className={`flex flex-col justify-between gap-3 rounded-2xl border-2 p-4 ${meta.cardClass}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                    <span className="tabular-nums text-xs font-bold opacity-90">
                      {rem.date} · {rem.time}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold">{rem.title}</h3>
                  {rem.note && <p className="mt-1 text-xs opacity-90">{rem.note}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      speakWithBestVoice(
                        `Recordatorio ${meta.label} para ${rem.date} a las ${rem.time}: ${rem.title}`
                      )
                    }
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
                      rem.status === 'finalizado'
                        ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                        : 'border-current/20 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Leer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFinish(rem.id)}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold ${
                      rem.status === 'finalizado'
                        ? 'bg-[#F5DF91] text-[#202020] hover:bg-[#EDD37A]'
                        : 'bg-[#171717] text-white hover:bg-black'
                    }`}
                  >
                    {rem.status === 'finalizado' ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Reactivar
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Marcar Finalizado
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
