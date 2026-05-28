
import React from 'react';
import { Lead } from '../types';
import { RefreshCw } from 'lucide-react';
import { formatLeadDate, formatLeadTime } from '../utils';

interface TrashProps {
  leads: Lead[];
  onSync: () => void;
  monthLabel: string;
  isSyncing?: boolean;
}

const Trash: React.FC<TrashProps> = ({ leads, onSync, monthLabel, isSyncing }) => {
  return (
    <div className="py-4">
      <div className="flex justify-between items-center mb-4 px-1">
        <span className="text-[11px] font-bold text-[#A0AEC0] uppercase tracking-wider">
          {leads.length} Leads em {monthLabel}
        </span>
        <button 
          onClick={onSync} 
          disabled={isSyncing}
          className="text-[11px] font-bold text-[#718096] uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
        >
          {isSyncing && <RefreshCw size={10} className="animate-spin" />}
          Sincronizar
        </button>
      </div>

      <div className="space-y-4">
        {leads.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-medium">Nenhum item no lixo para {monthLabel.toLowerCase()}.</div>
        ) : leads.map((lead) => (
          <div key={lead.id} className="bg-white rounded-[32px] ios-shadow border border-gray-50 p-6">
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-xl font-bold text-[#2D3748] leading-tight lowercase">{lead.name}</h3>
              <span className="px-3 py-1 bg-[#FFF5F5] rounded-full text-[10px] font-bold text-[#C53030] uppercase">Descartada</span>
            </div>
            <div className="flex gap-2 text-[11px] font-bold text-[#CBD5E0] mb-6">
              <span>#{lead.externalId}</span>
              <span>•</span>
              <span>{formatLeadDate(lead.timestamp)}</span>
              <span>•</span>
              <span>{formatLeadTime(lead.timestamp)}</span>
            </div>

            <div className="bg-[#F8F9FB] rounded-2xl p-4 border border-gray-100">
               <p className="text-[12px] text-slate-500 italic">"{lead.notes || 'Sem notas explicativas.'}"</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Trash;
