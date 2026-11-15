import type { LumiReminder, ReminderStatus } from '../types/lumi';

const REMINDERS_STORAGE_KEY = 'lumi_calendar_reminders_v1';

export function getTodayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentTimeString(now: Date = new Date()): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Calcula el estado automático del recordatorio.
 * Los recordatorios nunca se borran; si están finalizados permanecen en negro.
 */
export function computeReminderStatus(
  date: string,
  currentStatus: ReminderStatus,
  now: Date = new Date()
): ReminderStatus {
  if (currentStatus === 'finalizado') return 'finalizado';
  const today = getTodayDateString(now);
  if (date <= today) return 'hoy';
  return 'proximamente';
}

export function loadReminders(): LumiReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) {
      const today = getTodayDateString();
      const seed: LumiReminder[] = [
        {
          id: 'rem-seed-1',
          title: 'Revisar batería y conexión de LumiCube',
          date: today,
          time: '18:00',
          note: 'Recordatorio de ejemplo para hoy.',
          status: 'hoy',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as LumiReminder[];
    return Array.isArray(parsed)
      ? parsed.map((r) => ({
          ...r,
          status: computeReminderStatus(r.date, r.status),
        }))
      : [];
  } catch {
    return [];
  }
}

export function saveReminders(reminders: LumiReminder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  } catch {
    // Ignore storage quota issues
  }
}

export const REMINDER_STATUS_META: Record<
  ReminderStatus,
  {
    label: string;
    cardClass: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  proximamente: {
    label: 'Próximamente',
    cardClass: 'border-[#2E7D32] bg-[#EBF6ED] text-[#1E5629]',
    badgeClass: 'bg-[#1E5629] text-white',
    dotClass: 'bg-[#2E7D32]',
  },
  hoy: {
    label: 'Hoy',
    cardClass: 'border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]',
    badgeClass: 'bg-[#DC2626] text-white',
    dotClass: 'bg-[#DC2626]',
  },
  finalizado: {
    label: 'Finalizado',
    cardClass: 'border-[#000000] bg-[#171717] text-white',
    badgeClass: 'bg-white text-[#171717]',
    dotClass: 'bg-[#171717]',
  },
};

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

/**
 * Interpreta comandos de voz como:
 * "agregar un recordatorio tomar agua a las 16:00"
 * "agregar recordatorio cita medica 20 de noviembre a las 10 de la manana"
 * Si solo da la hora y ya pasó hoy, lo programa para mañana automáticamente.
 */
export function parseReminderFromSpeech(
  rawTranscript: string,
  now: Date = new Date()
): { title: string; date: string; time: string } | null {
  const norm = rawTranscript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const triggerMatch = norm.match(
    /^(?:agregar un recordatorio|agregar recordatorio|crear recordatorio|nuevo recordatorio|anadir recordatorio|recordar)\s+(.+)$/
  );
  if (!triggerMatch) return null;

  let body = triggerMatch[1].trim();
  let explicitDate: string | null = null;
  let explicitTime: string | null = null;

  // 1. Detectar fecha relativa ("pasado manana", "manana", "hoy")
  if (/\bpasado manana\b/.test(body)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    explicitDate = getTodayDateString(d);
    body = body.replace(/\bpasado manana\b/g, ' ');
  } else if (/\bmanana\b/.test(body)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    explicitDate = getTodayDateString(d);
    body = body.replace(/\bmanana\b/g, ' ');
  } else if (/\bhoy\b/.test(body)) {
    explicitDate = getTodayDateString(now);
    body = body.replace(/\bhoy\b/g, ' ');
  }

  // 2. Detectar fecha "DD de MES" o "DD/MM"
  const monthRegex = new RegExp(
    `\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${Object.keys(SPANISH_MONTHS).join('|')})\\b`
  );
  const monthMatch = body.match(monthRegex);
  if (!explicitDate && monthMatch) {
    const day = Math.min(31, Math.max(1, Number(monthMatch[1])));
    const monthIdx = SPANISH_MONTHS[monthMatch[2]];
    let year = now.getFullYear();
    const candidate = new Date(year, monthIdx, day);
    if (getTodayDateString(candidate) < getTodayDateString(now)) {
      year += 1;
    }
    explicitDate = getTodayDateString(new Date(year, monthIdx, day));
    body = body.replace(monthMatch[0], ' ');
  }

  const slashMatch = body.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!explicitDate && slashMatch) {
    const day = Math.min(31, Math.max(1, Number(slashMatch[1])));
    const monthIdx = Math.min(11, Math.max(0, Number(slashMatch[2]) - 1));
    const year = slashMatch[3]
      ? Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : now.getFullYear();
    explicitDate = getTodayDateString(new Date(year, monthIdx, day));
    body = body.replace(slashMatch[0], ' ');
  }

  // 3. Detectar hora ("a las 15:30", "a las 3 y media de la tarde", "a las 9", "18:00")
  const timeMatch = body.match(
    /\b(?:a las|las)?\s*(\d{1,2})(?::(\d{2})|\s+y\s+(media|cuarto))?\s*(de la tarde|de la noche|de la manana|pm|am)?\b/
  );
  if (timeMatch && (timeMatch[0].includes('las') || timeMatch[2] || timeMatch[3] || timeMatch[4])) {
    let hour = Number(timeMatch[1]);
    let minute = timeMatch[2]
      ? Number(timeMatch[2])
      : timeMatch[3] === 'media'
        ? 30
        : timeMatch[3] === 'cuarto'
          ? 15
          : 0;
    const period = timeMatch[4] ?? '';
    if ((period.includes('tarde') || period.includes('noche') || period === 'pm') && hour < 12) {
      hour += 12;
    } else if ((period.includes('manana') || period === 'am') && hour === 12) {
      hour = 0;
    }
    hour = Math.min(23, Math.max(0, hour));
    minute = Math.min(59, Math.max(0, minute));
    explicitTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    body = body.replace(timeMatch[0], ' ');
  }

  // Regla inteligente: si solo dio hora y ya pasó hoy, se programa para mañana
  let finalDate = explicitDate;
  const finalTime = explicitTime ?? '09:00';
  if (!finalDate) {
    const todayStr = getTodayDateString(now);
    const nowHHMM = getCurrentTimeString(now);
    if (explicitTime && explicitTime <= nowHHMM) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      finalDate = getTodayDateString(tomorrow);
    } else {
      finalDate = todayStr;
    }
  }

  const cleanTitle = body
    .replace(/\b(para el|para|el dia|el|a las)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : 'Recordatorio de voz',
    date: finalDate,
    time: finalTime,
  };
}
