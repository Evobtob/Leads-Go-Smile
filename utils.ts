
import { Lead } from './types';

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
      const d = new Date(lead.timestamp);
      if (isNaN(d.getTime())) return false;
      // Usamos getMonth e getFullYear que respeitam a hora local definida no parsing
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => {
      // Ordenação decrescente: o timestamp maior (mais recente) vem primeiro
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
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
