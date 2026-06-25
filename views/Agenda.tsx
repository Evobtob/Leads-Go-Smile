
import React, { useState } from 'react';
import { Lead } from '../types';
import { Calendar, User, RefreshCw, Euro, X, CheckCircle2, MessageSquare, Send, Edit3 } from 'lucide-react';
import { formatCurrency, toDateTimeLocalValue } from '../utils';

interface AgendaProps {
  leads: Lead[];
  onUpdateStatus: (id: string, updates: Partial<Lead>, extraData?: any) => void;
  onSendReminder: (lead: Lead) => void;
  onSync: () => void;
  monthLabel: string;
  isSyncing?: boolean;
}

const Agenda: React.FC<AgendaProps> = ({ leads, onUpdateStatus, onSendReminder, onSync, monthLabel, isSyncing }) => {
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [editAppointmentDate, setEditAppointmentDate] = useState('');
  const [editDoctor, setEditDoctor] = useState('');
  const [editComment, setEditComment] = useState('');

  const openFinishModal = (lead: Lead) => {
    setSelectedLead(lead);
    setBudgetAmount('');
    setShowFinishModal(true);
  };

  const openEditModal = (lead: Lead) => {
    setSelectedLead(lead);
    setEditAppointmentDate(toDateTimeLocalValue(lead.appointmentDate));
    setEditDoctor(lead.doctor || '');
    setEditComment('');
    setShowEditModal(true);
  };

  const handleEditAppointment = () => {
    if (!selectedLead || !editAppointmentDate) return;

    const previousNotes = selectedLead.notes?.trim() || '';
    const newNote = editComment.trim();
    const rescheduleNote = newNote ? `Reagendamento (${editAppointmentDate}): ${newNote}` : '';
    const notes = [previousNotes, rescheduleNote].filter(Boolean).join('\n');
    onUpdateStatus(
      selectedLead.id,
      { status: 'scheduled', doctor: editDoctor, appointmentDate: editAppointmentDate, notes },
      {
        medico: editDoctor,
        data_consulta: editAppointmentDate,
        data_agendada: editAppointmentDate,
        status: 'scheduled',
        comentario: notes,
        resumo_contacto: notes
      }
    );
    setShowEditModal(false);
  };

  const handleFinish = () => {
    if (!selectedLead) return;
    const value = parseFloat(budgetAmount) || 0;
    
    onUpdateStatus(selectedLead.id, 
      { status: 'completed', value }, 
      { 
        valor_fechado: value, 
        status: 'completed', 
        estado: 'FECHADO',
        comentario: `Venda fechada no valor de ${formatCurrency(value)}`
      }
    );
    setShowFinishModal(false);
  };

  return (
    <div className="py-4">
      <div className="flex justify-between items-center mb-6 px-1">
        <span className="text-[11px] font-bold text-[#A0AEC0] uppercase tracking-wider">
          {leads.length} Agendamentos
        </span>
        <button
          onClick={onSync} 
          disabled={isSyncing}
          className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
        >
          {isSyncing && <RefreshCw size={10} className="animate-spin" />}
          Atualizar
        </button>
      </div>

      <div className="space-y-6">
        {leads.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-medium">Nenhuma visita agendada para {monthLabel.toLowerCase()}.</div>
        ) : leads.map((lead) => (
          <div key={lead.id} className="bg-white rounded-[32px] ios-shadow border border-gray-50 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#2D3748] leading-tight">{lead.name}</h3>
                <span className="text-[11px] font-bold text-[#CBD5E0]">#{lead.externalId}</span>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-full text-[10px] font-bold uppercase">Agendado</span>
            </div>

            <div className="space-y-3 mb-4">
               <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                     <Calendar className="text-blue-500" size={20} />
                  </div>
                  <div>
                     <span className="text-[9px] font-bold text-slate-400 uppercase block">Data da Consulta</span>
                     <span className="text-sm font-bold text-slate-700">{lead.appointmentDate || 'A definir'}</span>
                  </div>
               </div>

               <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                     <User className="text-purple-500" size={20} />
                  </div>
                  <div>
                     <span className="text-[9px] font-bold text-slate-400 uppercase block">Médico Responsável</span>
                     <span className="text-sm font-bold text-slate-700">{lead.doctor || 'Não atribuído'}</span>
                  </div>
               </div>
            </div>

            {lead.notes && (
              <div className="bg-[#F8F9FB] rounded-2xl p-4 mb-6 border border-gray-100 flex gap-3">
                <MessageSquare size={14} className="text-slate-300 shrink-0 mt-0.5" />
                <p className="text-[12px] text-slate-500 italic">"{lead.notes}"</p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => openEditModal(lead)}
                disabled={isSyncing}
                className="py-4 rounded-2xl bg-amber-50 text-amber-600 text-[9px] font-bold uppercase active:bg-amber-100 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Edit3 size={10} /> Editar
              </button>
              <button
                onClick={() => onUpdateStatus(lead.id, { status: 'contacted' }, { estado: 'FALTOU', status: 'contacted', comentario: 'FALTOU' })}
                disabled={isSyncing}
                className="py-4 rounded-2xl bg-gray-50 text-gray-500 text-[9px] font-bold uppercase active:bg-gray-100 disabled:opacity-50"
              >
                Faltou
              </button>
              <button
                onClick={() => onSendReminder(lead)}
                disabled={isSyncing}
                className="py-4 rounded-2xl bg-blue-50 text-blue-600 text-[9px] font-bold uppercase active:bg-blue-100 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Send size={10} /> Lembrete
              </button>
              <button
                onClick={() => openFinishModal(lead)}
                disabled={isSyncing}
                className="py-4 rounded-2xl bg-black text-white text-[9px] font-bold uppercase active:scale-95 transition-transform disabled:opacity-50"
              >
                Finalizar
              </button>
            </div>
          </div>
        ))}
      </div>

      {showFinishModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Finalizar Consulta</h2>
                <button onClick={() => setShowFinishModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 mb-6">
                  <p className="text-blue-600 text-sm font-bold mb-1">Paciente: {selectedLead?.name}</p>
                  <p className="text-blue-500 text-[11px]">A lead deixará de ser prospecto e passará a paciente com orçamento registado.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Valor Total do Orçamento (€)</label>
                  <div className="relative">
                    <Euro className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      className="w-full h-16 bg-slate-50 rounded-2xl pl-16 pr-6 outline-none border border-transparent focus:border-blue-200 font-bold text-2xl text-slate-700"
                    />
                  </div>
                </div>

                <button
                  onClick={handleFinish}
                  disabled={!budgetAmount || parseFloat(budgetAmount) < 0}
                  className="w-full h-16 bg-green-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-30"
                >
                  <CheckCircle2 size={20} />
                  Concluir e Registar Paciente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-8 max-h-[85vh] overflow-y-auto hide-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Editar Marcação</h2>
                <button onClick={() => setShowEditModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                  <p className="text-blue-600 text-sm font-bold mb-1">Paciente: {selectedLead?.name}</p>
                  <p className="text-blue-500 text-[11px]">Altere a data/hora ou médico e submeta para atualizar a Google Sheet.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Data e Hora</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="datetime-local"
                      value={editAppointmentDate}
                      onChange={(e) => setEditAppointmentDate(e.target.value)}
                      className="w-full h-16 bg-slate-50 rounded-2xl pl-16 pr-6 outline-none border border-transparent focus:border-blue-200 font-bold text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Médico Responsável</label>
                  <input
                    type="text"
                    value={editDoctor}
                    onChange={(e) => setEditDoctor(e.target.value)}
                    placeholder="Nome do médico"
                    className="w-full h-16 bg-slate-50 rounded-2xl px-6 outline-none border border-transparent focus:border-blue-200 font-bold text-slate-700"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Nota da alteração (opcional)</label>
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    placeholder="Ex: Reagendada a pedido do paciente..."
                    className="w-full h-28 bg-slate-50 rounded-2xl p-5 outline-none border border-transparent focus:border-blue-200 font-medium text-slate-700"
                  />
                </div>

                <button
                  onClick={handleEditAppointment}
                  disabled={!editAppointmentDate || isSyncing}
                  className="w-full h-16 bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-30"
                >
                  <CheckCircle2 size={20} />
                  Submeter Alteração
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
