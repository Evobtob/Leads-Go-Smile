
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Inbox from './views/Inbox';
import Trash from './views/Trash';
import Agenda from './views/Agenda';
import Accounts from './views/Accounts';
import Admin from './views/Admin';
import { AppView, Lead, AdminSettings, LeadUpdatePayload } from './types';
import { formatMonthYear, getLeadsByMonth, inferStatus } from './utils';

const GOOGLE_SHEET_ID = '18RbQhpBsG7DpIky1hF3TvhxC31CTEC_v-cGkpa1d6PI';
const WEBHOOK_URL = 'https://n8n.evob.org/webhook/997a304a-2dc7-4c4e-b935-bd19ce7f87de';
const UPDATE_WEBHOOK_URL = 'https://n8n.evob.org/webhook/2f28ed96-5ed8-48af-b009-1d519cf07f9b';
const REMINDER_WEBHOOK_URL = 'https://n8n.evob.org/webhook/reminder-email-gosmile'; // URL sugerida para lembretes

const withSheetId = (baseUrl: string): string => {
  const url = new URL(baseUrl);
  url.searchParams.set('sheetId', GOOGLE_SHEET_ID);
  return url.toString();
};

const LEADS_WEBHOOK_URL = withSheetId(WEBHOOK_URL);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('resumo');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState<AdminSettings>({
    commissionPercent: 3,
    dataUrl: LEADS_WEBHOOK_URL,
    sheetId: GOOGLE_SHEET_ID
  });
  const [isInvalidSource, setIsInvalidSource] = useState(false);

  const extractRawDate = (item: any): string => {
    return String(item.Data ?? item['4'] ?? item.data ?? item.timestamp ?? '').trim();
  };

  const parseLeadDate = (rawDate: string): Date | null => {
    if (!rawDate || rawDate === 'z') return null;

    const nativeDate = new Date(rawDate);
    if (!isNaN(nativeDate.getTime())) return nativeDate;

    const [datePart, timePart = '00:00:00'] = rawDate.split(' ');
    const [yyyy, mm, dd] = datePart.split('-').map(n => parseInt(n, 10));
    const [hh, min, ss = 0] = timePart.split(':').map(n => parseInt(n, 10));

    if ([yyyy, mm, dd, hh, min, ss].some(n => Number.isNaN(n))) return null;

    const parsed = new Date(yyyy, mm - 1, dd, hh, min, ss);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizeKey = (key: string): string => key
    .normalize('NFD')
    .replace(/[^\w\s]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  const SOURCE_SCHEMA_ALIASES: Record<string, string[]> = {
    source: ['source', 'origem', 'canal', 'utm_source'],
    lead_quality: ['lead_quality', 'qualidade_lead', 'qualidade', 'status_lead'],
    name: ['name', 'nome', 'lead_name', 'full_name'],
    phone: ['phone', 'telefone', 'telemovel', 'celular', 'mobile'],
    email: ['email', 'e_mail', 'mail'],
    location: ['location', 'localizacao', 'cidade', 'regiao', 'bairro'],
    date: ['data', 'date', 'timestamp', 'created_at']
  };

  const validateSourceSchema = (rows: any[]): boolean => {
    if (!Array.isArray(rows) || rows.length === 0) return false;

    const sampleRows = rows.slice(0, 20).filter((row) => row && typeof row === 'object');
    if (sampleRows.length === 0) return false;

    const normalizedKeys = new Set(
      sampleRows.flatMap((row) => Object.keys(row).map(normalizeKey))
    );

    const hasAnyAlias = (canonicalField: keyof typeof SOURCE_SCHEMA_ALIASES): boolean => {
      return SOURCE_SCHEMA_ALIASES[canonicalField].some((alias) => normalizedKeys.has(alias));
    };

    const requiredFields: Array<keyof typeof SOURCE_SCHEMA_ALIASES> = ['source', 'name', 'phone', 'email'];
    const requiredOk = requiredFields.every(hasAnyAlias);
    const contextualOk = hasAnyAlias('lead_quality') || hasAnyAlias('location') || hasAnyAlias('date');

    return requiredOk && contextualOk;
  };

  const mapDataToLeads = (data: any[]): Lead[] => {
    return data
      .filter(item => parseLeadDate(extractRawDate(item)) !== null)
      .map((item: any) => {
        const parsedDate = parseLeadDate(extractRawDate(item));
        const timestamp = (parsedDate || new Date()).toISOString();

        return {
          id: String(item.row_number || Math.random()),
          externalId: String(item.row_number || '0'),
          name: String(item.Nome || 'Sem Nome'),
          phone: String(item.Telefone || ''),
          email: item.Email || '',
          timestamp,
          status: inferStatus(item),
          isContacted: !!(item["Data Contacto"] || item["Responsável"]),
          notes: item.Comentários || '',
          doctor: item.Médico || '',
          appointmentDate: item["Data Primeira Consulta"] || '',
          value: parseFloat(item["Valor Real Bruto"]) || 0
        };
      });
  };

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    setIsInvalidSource(false);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(LEADS_WEBHOOK_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          if (!validateSourceSchema(data)) {
            setLeads([]);
            setIsInvalidSource(true);
            setFetchError('Fonte inválida');
            return;
          }

          const mappedLeads = mapDataToLeads(data);
          setLeads(mappedLeads);

          if (mappedLeads.length > 0) {
            const latestTimestamp = mappedLeads.reduce((latest, lead) => {
              return new Date(lead.timestamp).getTime() > new Date(latest.timestamp).getTime() ? lead : latest;
            }).timestamp;
            const latestDate = new Date(latestTimestamp);
            setSelectedDate(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
          }

          return;
        }
      }
      throw new Error("Erro de rede");
    } catch (error) {
      setLeads([]);
      setFetchError("Erro ao carregar dados da fonte");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleLeadAction = async (id: string, updates: Partial<Lead>, extraData?: Partial<LeadUpdatePayload>) => {
    setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, ...updates } : lead));
    
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    setIsSyncing(true);
    const now = new Date();
    const formattedNow = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    try {
      const payload: LeadUpdatePayload = {
        row_number: lead.externalId,
        nome: lead.name,
        status: updates.status || lead.status,
        estado: extraData?.estado,
        comentario: extraData?.comentario || updates.notes,
        medico: extraData?.medico || updates.doctor,
        data_consulta: extraData?.data_consulta || updates.appointmentDate,
        valor_fechado: extraData?.valor_fechado !== undefined ? extraData.valor_fechado : updates.value,
        data_tratamento: formattedNow
      };

      const response = await fetch(UPDATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Sync falhou");
    } catch (error) {
      console.error('Failed to sync:', error);
      setFetchError("Erro na sincronização");
      setTimeout(() => setFetchError(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendReminder = async (lead: Lead) => {
    setIsSyncing(true);
    try {
      // Incluindo todos os campos conforme solicitado para garantir que o n8n tenha toda a informação
      const payload = {
        row_number: lead.externalId,
        nome: lead.name,
        telefone: lead.phone,
        email: lead.email,
        medico: lead.doctor,
        data_consulta: lead.appointmentDate,
        comentarios: lead.notes,
        status: lead.status,
        timestamp_envio: new Date().toISOString()
      };

      const response = await fetch(REMINDER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error("Falha ao enviar lembrete");
      alert(`Lembrete enviado com sucesso para ${lead.name}`);
    } catch (error) {
      console.error('Reminder failed:', error);
      alert("Erro ao enviar lembrete de e-mail.");
    } finally {
      setIsSyncing(false);
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
  };

  const monthLabel = formatMonthYear(selectedDate);
  const currentLeads = getLeadsByMonth(leads, selectedDate.getMonth(), selectedDate.getFullYear());

  const renderView = () => {
    switch (activeView) {
      case 'resumo': return <Dashboard leads={currentLeads} monthLabel={monthLabel} />;
      case 'inbox': return (
        <Inbox 
          leads={currentLeads.filter(l => l.status === 'new' || l.status === 'contacted')} 
          onUpdateStatus={handleLeadAction} 
          onSync={fetchLeads} 
          monthLabel={monthLabel}
          isSyncing={isSyncing}
        />
      );
      case 'lixo': return <Trash leads={currentLeads.filter(l => l.status === 'discarded')} onSync={fetchLeads} monthLabel={monthLabel} isSyncing={isSyncing} />;
      case 'visitas': return (
        <Agenda 
          leads={currentLeads.filter(l => l.status === 'scheduled')} 
          onUpdateStatus={handleLeadAction} 
          onSendReminder={handleSendReminder}
          onSync={fetchLeads} 
          monthLabel={monthLabel} 
          isSyncing={isSyncing} 
        />
      );
      case 'contas': return (
        <Accounts 
          leads={currentLeads.filter(l => l.status === 'completed' || l.status === 'paid')} 
          onUpdateStatus={handleLeadAction} 
          onSync={fetchLeads} 
          monthLabel={monthLabel} 
          isSyncing={isSyncing} 
        />
      );
      case 'admin': return <Admin settings={settings} onUpdateSettings={setSettings} leads={leads} onUpdateStatus={handleLeadAction} />;
      default: return <Dashboard leads={currentLeads} monthLabel={monthLabel} />;
    }
  };

  return (
    <Layout 
      activeView={activeView} 
      setActiveView={setActiveView} 
      title={activeView === 'resumo' ? 'Resumo' : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
      subtitle={activeView === 'resumo' ? 'GOSMILE CLINIC' : undefined}
      currentMonthLabel={monthLabel}
      onPrevMonth={() => changeMonth(-1)}
      onNextMonth={() => changeMonth(1)}
      onSync={fetchLeads}
      isSyncing={isLoading || isSyncing}
    >
      {(fetchError || isSyncing) && (
        <div className={`px-4 py-2 text-[10px] font-bold text-center uppercase tracking-tight transition-all fixed top-[110px] left-0 right-0 z-50 shadow-md ${isSyncing ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}>
          {isSyncing ? "A processar..." : fetchError}
        </div>
      )}
      {isInvalidSource ? (
        <div className="mt-8 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 text-center font-bold">
          Fonte inválida
        </div>
      ) : renderView()}
    </Layout>
  );
};

export default App;
