
import { Lead } from './types';

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

const isValidDateParts = (year: number, month: number, day: number, hour: number, minute: number, second: number): boolean => {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;

  const candidate = new Date(year, month - 1, day, hour, minute, second);
  return (
    candidate.getFullYear() === year
    && candidate.getMonth() === month - 1
    && candidate.getDate() === day
    && candidate.getHours() === hour
    && candidate.getMinutes() === minute
    && candidate.getSeconds() === second
  );
};

export const parseLeadDate = (raw: unknown): Date | null => {
  if (raw === null || raw === undefined) return null;

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Epoch em ms
    if (raw > 1_000_000_000_000) {
      const asMs = new Date(raw);
      return Number.isNaN(asMs.getTime()) ? null : asMs;
    }
    // Epoch em segundos
    if (raw > 1_000_000_000) {
      const asSec = new Date(raw * 1000);
      return Number.isNaN(asSec.getTime()) ? null : asSec;
    }
    // Número serial típico do Google Sheets/Excel
    if (raw >= 20_000 && raw <= 100_000) {
      const asSerial = new Date(EXCEL_EPOCH_UTC_MS + raw * 24 * 60 * 60 * 1000);
      return Number.isNaN(asSerial.getTime()) ? null : asSerial;
    }
  }

  const text = String(raw).trim();
  if (!text) return null;
  if (['z', 'invalid date', 'null', 'undefined', '-', 'n/a'].includes(text.toLowerCase())) return null;

  const nativeDate = new Date(text);
  if (!Number.isNaN(nativeDate.getTime())) return nativeDate;

  const normalized = text
    .replace(',', ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = normalized.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})(?:[ T](\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/);
  if (!match) return null;

  const [, p1, p2, p3, hh = '0', mm = '0', ss = '0'] = match;
  let year = 0;
  let month = 0;
  let day = 0;

  if (p1.length === 4) {
    year = Number.parseInt(p1, 10);
    month = Number.parseInt(p2, 10);
    day = Number.parseInt(p3, 10);
  } else if (p3.length === 4) {
    day = Number.parseInt(p1, 10);
    month = Number.parseInt(p2, 10);
    year = Number.parseInt(p3, 10);
  } else {
    return null;
  }

  const hour = Number.parseInt(hh, 10);
  const minute = Number.parseInt(mm, 10);
  const second = Number.parseInt(ss, 10);
  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) return null;
  if (!isValidDateParts(year, month, day, hour, minute, second)) return null;

  return new Date(year, month - 1, day, hour, minute, second);
};

export const toTimestampMs = (raw: unknown): number => {
  const parsed = parseLeadDate(raw);
  return parsed ? parsed.getTime() : Number.NEGATIVE_INFINITY;
};

export const formatLeadDate = (raw: unknown, fallback = 'Sem data'): string => {
  const parsed = parseLeadDate(raw);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatLeadTime = (raw: unknown, fallback = '—'): string => {
  const parsed = parseLeadDate(raw);
  if (!parsed) return fallback;
  return parsed.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

export const formatMonthYear = (date: Date): string => {
  const months = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  return `${months[date.getMonth()]} DE ${date.getFullYear()}`;
};

export const getLeadsByMonth = (leads: Lead[], month: number, year: number): Lead[] => {
  return leads
    .filter(lead => {
      const ms = toTimestampMs(lead.timestamp);
      // Mantém leads sem data visíveis em qualquer mês para evitar "desaparecerem" da app
      // quando a fonte vier com timestamp vazio.
      if (!Number.isFinite(ms)) return true;
      const d = new Date(ms);
      // Usamos getMonth e getFullYear que respeitam a hora local definida no parsing
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => {
      // Ordenação decrescente: o timestamp maior (mais recente) vem primeiro.
      // Leads sem timestamp válido ficam no fim (toTimestampMs => -Infinity).
      return toTimestampMs(b.timestamp) - toTimestampMs(a.timestamp);
    });
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
};

export const inferStatus = (item: any): any => {
  const notes = (item.Comentários || '').toLowerCase();
  const appointment = item["Data Primeira Consulta"];
  
  if ((appointment && appointment.length > 2) || notes.includes('marcado')) {
    return 'scheduled';
  }
  
  const discardKeywords = ['engano', 'não atende', 'não interessa', 'desligou', 'longe', 'errado', 'não precisa', 'incorrecto', 'falecido'];
  if (discardKeywords.some(key => notes.includes(key))) {
    return 'discarded';
  }
  
  return 'new';
};
