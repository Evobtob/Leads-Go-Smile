
import { Lead } from './types';

export const toTimestampMs = (raw: string): number => {
  if (!raw) return Number.NEGATIVE_INFINITY;
  const d = new Date(raw);
  const ms = d.getTime();
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
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
      if (!Number.isFinite(ms)) return false;
      const d = new Date(ms);
      // Usamos getMonth e getFullYear que respeitam a hora local definida no parsing
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => {
      // Ordenação decrescente: o timestamp maior (mais recente) vem primeiro
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
