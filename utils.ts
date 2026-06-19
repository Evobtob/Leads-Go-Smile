
import { Lead } from './types';

export const normalizeLeadStatus = (raw: unknown): Lead['status'] | null => {
  const value = String(raw ?? '').trim().toLowerCase();
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const aliases: Record<string, Lead['status']> = {
    new: 'new',
    novo: 'new',
    nova: 'new',
    contacted: 'contacted',
    contactado: 'contacted',
    contactada: 'contacted',
    contactada_ligar: 'contacted',
    positive: 'positive',
    positivo: 'positive',
    positiva: 'positive',
    discarded: 'discarded',
    descartado: 'discarded',
    descartada: 'discarded',
    nao_interessada: 'discarded',
    nao_interessado: 'discarded',
    scheduled: 'scheduled',
    agendado: 'scheduled',
    agendada: 'scheduled',
    marcado: 'scheduled',
    marcada: 'scheduled',
    completed: 'completed',
    concluido: 'completed',
    concluida: 'completed',
    fechado: 'completed',
    fechada: 'completed',
    venda_fechada: 'completed',
    paid: 'paid',
    pago: 'paid',
    paga: 'paid'
  };

  return aliases[normalized] || null;
};

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
  const isMarked = (value: string): boolean => ['x', '✓', '✔', '✅', 'sim', 'yes', 'true', '1'].includes(value);
  const discardedFlag = String(item.discarded_flag || item.descartada || item.Descartada || '').trim().toLowerCase();
  if (isMarked(discardedFlag)) return 'discarded';

  const explicitStatus = normalizeLeadStatus(item.status || item.estado || item.Estado || item['[STATUS]']);
  if (explicitStatus) return explicitStatus;

  const notes = String(item.Comentários || item.Notas || item.notes || '').toLowerCase();
  const appointment = String(item['Data Primeira Consulta'] || item.appointmentDate || item.data_agendada || '').trim();
  const sendFlag = String(item.Enviar || item.enviar || item.send_flag || '').trim().toLowerCase();
  const callFlag = String(item.Ligar || item.ligar || item.call_flag || '').trim().toLowerCase();

  const statusMarker = notes.match(/\[status\s*:\s*(new|contacted|discarded|scheduled|positive|completed|paid)\]/i);
  if (statusMarker) {
    const markedStatus = normalizeLeadStatus(statusMarker[1]);
    if (markedStatus) return markedStatus;
  }

  if (notes.includes('pago') || notes.includes('pagamento confirmado')) return 'paid';
  if (notes.includes('venda fechada') || notes.includes('orçamento fechado') || notes.includes('orcamento fechado') || notes.includes('fechado no valor')) return 'completed';

  const discardKeywords = ['engano', 'não atende', 'não interessa', 'não tem interesse', 'sem interesse', 'desligou', 'longe', 'errado', 'não precisa', 'incorrecto', 'incorreto', 'falecido', 'descartad'];
  if (discardKeywords.some(key => notes.includes(key))) {
    return 'discarded';
  }

  if ((appointment && appointment.length > 2) || isMarked(sendFlag) || notes.includes('marcado') || notes.includes('agendado')) {
    return 'scheduled';
  }

  if (isMarked(callFlag) || notes.includes('liguei') || notes.includes('contactado') || notes.includes('contactada') || notes.includes('ligar mais tarde')) {
    return 'contacted';
  }

  return 'new';
};
