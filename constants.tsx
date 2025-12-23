
import React from 'react';
import { LayoutGrid, Activity, Trash2, Calendar, PlusCircle, Settings } from 'lucide-react';
import { AppView } from './types';

export const NAVIGATION_ITEMS = [
  { id: 'resumo' as AppView, label: 'RESUMO', icon: <LayoutGrid size={22} /> },
  { id: 'inbox' as AppView, label: 'INBOX', icon: <Activity size={22} /> },
  { id: 'lixo' as AppView, label: 'LIXO', icon: <Trash2 size={22} /> },
  { id: 'visitas' as AppView, label: 'VISITAS', icon: <Calendar size={22} /> },
  { id: 'contas' as AppView, label: 'CONTAS', icon: <PlusCircle size={22} /> },
  { id: 'admin' as AppView, label: 'ADMIN', icon: <Settings size={22} /> },
];

// Dados reais fornecidos para garantir funcionamento offline/fallback
export const MOCK_LEADS_DATA = [
  {
    "row_number": 2,
    "Data": "2024-10-03 22:15:37",
    "Origem": "Facebook",
    "Nome": "Pedro Ferreira Ana Vidal",
    "Email": "pedrolopesferreira@sapo.pt",
    "Telefone": 351917883059,
    "Comentários": "Vai ser operado. Entrar em contacto dia ",
    "Data Contacto": "04.10.24 - 12h"
  },
  {
    "row_number": 4,
    "Data": "2024-10-07 18:59:31",
    "Origem": "Facebook",
    "Nome": "Bruno Melo",
    "Email": "bruno181200@gmail.com",
    "Telefone": 351911734604,
    "Comentários": "marcado",
    "Data Primeira Consulta": "19.10.24",
    "Médico": "dr joana"
  },
  {
    "row_number": 13,
    "Data": "2025-05-10 11:11:24",
    "Origem": "Facebook",
    "Nome": "Luís Mota",
    "Email": "motaluis551@gmail.com",
    "Telefone": 351967890011,
    "Comentários": ""
  },
  {
    "row_number": 24,
    "Data": "2024-10-16 19:10:35",
    "Origem": "Facebook",
    "Nome": "cristiane dos santos pereira",
    "Email": "cristianesantospt2026@gmail.com",
    "Telefone": 351912152867,
    "Comentários": "MARCADA",
    "Data Primeira Consulta": "18-10-24",
    "Médico": "BR BRUNO"
  },
  {
    "row_number": 91,
    "Data": "2024-12-01 17:03:10",
    "Origem": "Facebook",
    "Nome": "Joao Marques Pepino",
    "Email": "marquespepino@gmail.com",
    "Telefone": 351936461882,
    "Comentários": "marcado para amanha ",
    "Médico": "dra sara"
  },
  {
    "row_number": 315,
    "Data": "2025-03-03 21:24:56",
    "Origem": "Facebook",
    "Nome": "Rosa Maria Coelho Nascimento",
    "Email": "rosamariacoelhonascimento@gmail.com",
    "Telefone": 351910853264,
    "Comentários": "marcada",
    "Data Primeira Consulta": "11/04/25",
    "Médico": "dr bruno"
  },
  {
    "row_number": 544,
    "Data": "2025-05-10 11:11:24",
    "Origem": "Facebook",
    "Nome": "Luís Mota",
    "Email": "motaluis551@gmail.com",
    "Telefone": 351967890011,
    "Comentários": "marcado",
    "Data Primeira Consulta": "24/05",
    "Médico": "dr bruno"
  },
  {
    "row_number": 689,
    "Data": "2025-06-23 13:12:54",
    "Origem": "Facebook",
    "Nome": "Daniel Filipe Simões Ferreira",
    "Email": "FerreiraFilipeDaniel793@Gmail.com",
    "Telefone": 351926128422,
    "Comentários": "nao atendeu/marcado",
    "Data Primeira Consulta": "30/06/25",
    "Médico": "dra joana"
  },
  {
    "row_number": 801,
    "Data": "2025-07-28 11:58:59",
    "Origem": "Facebook",
    "Nome": "Amaurilio Sansil",
    "Email": "meuconctato@gmail.com",
    "Telefone": 351912844288,
    "Comentários": "marcado",
    "Data Primeira Consulta": "04/08/2025",
    "Médico": "bruno"
  },
  {
    "row_number": 948,
    "Data": "2025-09-03 23:00:00",
    "Origem": "Facebook",
    "Nome": "João Edson Tofano Junior",
    "Email": "jetj.pt.2024@gmail.com",
    "Telefone": 351939005570,
    "Comentários": "nao atendeu/nao atendeu"
  }
];
