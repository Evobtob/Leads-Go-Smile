
import React from 'react';
import { Lead } from '../types';
import { formatCurrency } from '../utils';
import { RefreshCw, CheckCircle, CreditCard } from 'lucide-react';

interface AccountsProps {
  leads: Lead[];
  onUpdateStatus: (id: string, updates: Partial<Lead>, extraData?: any) => void;
  onSync: () => void;
  monthLabel: string;
  isSyncing?: boolean;
}

const Accounts: React.FC<AccountsProps> = ({ leads, onUpdateStatus, onSync, monthLabel, isSyncing }) => {
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
          <div className="text-center py-20 text-gray-400 font-medium">Nenhuma conta finalizada para {monthLabel.toLowerCase()}.</div>
        ) : leads.map((lead) => {
          const value = lead.value || 0; 
          
          return (
            <div key={lead.id} className="bg-white rounded-[32px] ios-shadow border border-gray-50 p-6">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-xl font-bold text-[#2D3748] leading-tight">{lead.name}</h3>
                <span className="px-3 py-1 bg-[#E6F3EF] rounded-full text-[10px] font-bold text-[#2F855A] uppercase">Venda Fechada</span>
              </div>
              <div className="flex gap-2 text-[11px] font-bold text-[#CBD5E0] mb-6">
                <span>#{lead.externalId}</span>
                <span>•</span>
                <span>{new Date(lead.timestamp).toLocaleDateString('pt-PT')}</span>
              </div>

              <div className="mb-6">
                <div className="bg-[#F8F9FB] rounded-[24px] p-5 flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                       <CreditCard size={18} className="text-blue-500" />
                    </div>
                    <span className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest block">Valor do Orçamento</span>
                  </div>
                  <span className="text-xl font-bold text-[#2D3748]">{formatCurrency(value)}</span>
                </div>
              </div>

              <button 
                onClick={() => onUpdateStatus(lead.id, { status: 'paid' }, { status: 'paid', estado: 'PAGO' })}
                disabled={isSyncing}
                className="w-full py-4 rounded-2xl bg-[#2D3748] text-white text-[12px] font-bold uppercase tracking-wider active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                Confirmar Pagamento
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Accounts;
