
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Inbox from './views/Inbox';
import Trash from './views/Trash';
import Agenda from './views/Agenda';
import Accounts from './views/Accounts';
import Admin from './views/Admin';
import { AppView, Lead, AdminSettings, LeadUpdatePayload } from './types';
import { formatMonthYear, getLeadsByMonth, inferStatus, normalizeLeadStatus, parseLeadDate, toTimestampMs } from './utils';

const GOOGLE_SHEET_ID = '1LMcABXhrGZE0fZhRSWTS0pXRmwGsruUIbs90iqUTba4';
const APPS_SCRIPT_BASE_URL = 'https://script.google.com/macros/s/AKfycbzOXEHfjsc5DAo6VOh-6iNFQOZM6qyPMkDZmQC_CI3sekf4dP6qWpLdUBHM9DLnf2I/exec';
const withAction = (action: string, extra: Record<string, string> = {}): string => {
  const url = new URL(APPS_SCRIPT_BASE_URL);
  url.searchParams.set('action', action);
  Object.entries(extra).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

const LEADS_WEBHOOK_URL = withAction('getLeads');
const FETCH_TIMEOUT_MS = 30000;
const FETCH_MAX_RETRIES = 2;
const FETCH_BACKOFF_MS = 2000;

type FetchFailureKind = 'network' | 'timeout' | 'http' | 'schema' | 'parse';

type FetchFailure = {
  kind: FetchFailureKind;
  message: string;
  details?: string;
  status?: number;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido';
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('resumo');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState<AdminSettings>({
    commissionPercent: 3,
    dataUrl: LEADS_WEBHOOK_URL,
    sheetId: GOOGLE_SHEET_ID
  });
  const [isInvalidSource, setIsInvalidSource] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

  const extractRawDate = (item: any): string => {
    return String(item.Data ?? item['4'] ?? item.data ?? item.timestamp ?? '').trim();
  };


  const normalizeKey = (key: string): string => key
    .normalize('NFD')
    .replace(/[^\w\s]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  const SOURCE_SCHEMA_ALIASES: Record<string, string[]> = {
    row_number: ['row_number', 'row', 'id', 'lead_id', 'linha', 'line_number'],
    source: ['source', 'origem', 'canal', 'utm_source'],
    lead_quality: ['lead_quality', 'qualidade_lead', 'qualidade', 'status_lead', 'lead_status'],
    name: ['name', 'nome', 'lead_name', 'full_name', 'cliente', 'contact_name'],
    phone: ['phone', 'telefone', 'telemovel', 'celular', 'mobile', 'whatsapp', 'telefone_1', 'número', 'numero'],
    email: ['email', 'e_mail', 'mail', 'email_address'],
    location: ['location', 'localizacao', 'cidade', 'regiao', 'bairro'],
    date: ['data', 'date', 'timestamp', 'created_at', '4', 'lead_created_at'],
    speciality: ['especialidade', 'speciality', 'specialty'],
    notes: ['comentarios', 'comentários', 'comments', 'notes', 'observacoes', 'observações', 'notas'],
    contact_date: ['data_contacto', 'data contato', 'contact_date', 'contacted_at'],
    owner: ['responsavel', 'responsável', 'owner', 'responsible'],
    doctor: ['medico', 'médico', 'doctor'],
    appointment_date: ['data_primeira_consulta', 'primeira_consulta', 'appointment_date', 'consulta'],
    resumo_contacto: ['resumo_contacto', 'resumo contacto', 'resumo_de_contacto', 'resumo'],
    data_agendada: ['data_agendada', 'data agendada', 'agendada_em', 'appointment_scheduled_at'],
    appointment_day: ['dia', 'day'],
    appointment_month: ['mês', 'mes', 'month'],
    appointment_hour: ['hora', 'hour'],
    appointment_minute: ['minuto', 'minute'],
    send_flag: ['enviar', 'send'],
    call_flag: ['ligar', 'call'],
    discarded_flag: ['descartadas', 'descartada', 'descartado', 'discarded_flag', 'discarded', 'lixo', 'trash'],
    scheduled_flag: ['agendadas', 'agendada', 'agendado', 'scheduled_flag', 'scheduled', 'agendamento', 'visitas'],
    campaign: ['campanha', 'campaign'],
    ad_set: ['ad set', 'ad_set', 'adset'],
    ad: ['ad', 'anuncio', 'anúncio'],
    platform: ['plataforma', 'platform'],
    value: ['valor_real_bruto', 'valor_fechado', 'valor', 'value', 'budget', 'amount']
  };

  const aliasToCanonical = Object.entries(SOURCE_SCHEMA_ALIASES).reduce<Record<string, string>>((acc, [canonical, aliases]) => {
    aliases.forEach((alias) => {
      acc[normalizeKey(alias)] = canonical;
    });
    return acc;
  }, {});

  const normalizeRow = (item: Record<string, unknown>): Record<string, unknown> => {
    return Object.entries(item).reduce<Record<string, unknown>>((acc, [rawKey, value]) => {
      const normalizedRawKey = normalizeKey(rawKey);
      const canonicalKey = aliasToCanonical[normalizedRawKey] || normalizedRawKey;
      if (canonicalKey === 'discarded_flag' && normalizedRawKey === 'descartadas') {
        acc[canonicalKey] = value;
        return acc;
      }
      if (canonicalKey === 'scheduled_flag' && normalizedRawKey === 'agendadas') {
        acc[canonicalKey] = value;
        return acc;
      }
      if (canonicalKey === 'discarded_flag' && Object.prototype.hasOwnProperty.call(acc, canonicalKey)) {
        return acc;
      }
      if (canonicalKey === 'scheduled_flag' && Object.prototype.hasOwnProperty.call(acc, canonicalKey)) {
        return acc;
      }
      if (acc[canonicalKey] === undefined || acc[canonicalKey] === null || acc[canonicalKey] === '') {
        acc[canonicalKey] = value;
      }
      return acc;
    }, {});
  };

  const parseNumberValue = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;

    const sanitized = value
      .trim()
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');

    const parsed = Number.parseFloat(sanitized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const schemaCheck = (rows: any[]): { valid: boolean; missingRequired: string[]; availableFields: string[] } => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { valid: false, missingRequired: ['payload_vazio'], availableFields: [] };
    }

    const sampleRows = rows.slice(0, 30).filter((row) => row && typeof row === 'object');
    if (sampleRows.length === 0) {
      return { valid: false, missingRequired: ['linhas_invalidas'], availableFields: [] };
    }

    const normalizedKeys = new Set(
      sampleRows.flatMap((row) => Object.keys(normalizeRow(row)).map(normalizeKey))
    );

    const requiredFields: Array<keyof typeof SOURCE_SCHEMA_ALIASES> = ['name', 'phone', 'email'];
    const missingRequired = requiredFields.filter((field) => !normalizedKeys.has(field));
    const availableFields = Array.from(normalizedKeys).sort();

    return { valid: missingRequired.length === 0, missingRequired, availableFields };
  };

  const firstValue = (...values: unknown[]): string => {
    const found = values.find((value) => String(value ?? '').trim() !== '');
    return String(found ?? '').trim();
  };

  const isMarked = (value: unknown): boolean => ['x', '✓', '✔', '✅', 'sim', 'yes', 'true', '1'].includes(String(value ?? '').trim().toLowerCase());

  const buildAppointmentDate = (normalized: Record<string, unknown>, leadDate: Date | null): string => {
    const direct = firstValue(normalized.data_agendada, normalized.appointment_date);
    if (direct) return direct;

    const day = Number.parseInt(String(normalized.appointment_day ?? ''), 10);
    const month = Number.parseInt(String(normalized.appointment_month ?? ''), 10);
    const hour = Number.parseInt(String(normalized.appointment_hour ?? ''), 10);
    const minute = Number.parseInt(String(normalized.appointment_minute ?? ''), 10);
    if ([day, month, hour, minute].some((n) => Number.isNaN(n))) return '';

    const year = leadDate?.getFullYear() || new Date().getFullYear();
    const date = new Date(year, month - 1, day, hour, minute, 0);
    if (
      date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
      || date.getHours() !== hour
      || date.getMinutes() !== minute
    ) return '';

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const mapDataToLeads = (data: any[]): Lead[] => {
    return data
      .filter((item: any) => {
        const normalized = normalizeRow(item);
        return !!(firstValue(normalized.name) && (firstValue(normalized.phone) || firstValue(normalized.email)));
      })
      .map((item: any) => {
        const normalized = normalizeRow(item);
        const parsedDate = parseLeadDate(String(normalized.date ?? extractRawDate(item) ?? ''));
        const notes = firstValue(normalized.resumo_contacto, normalized.notes);
        const appointmentDate = buildAppointmentDate(normalized, parsedDate);
        // Preserva linhas sem data, mas evita "agora" artificial (que distorcia ordenação por recência).
        const timestamp = parsedDate ? parsedDate.toISOString() : '';

        const status = isMarked(normalized.discarded_flag)
          ? 'discarded'
          : isMarked(normalized.scheduled_flag)
            ? 'scheduled'
            : normalizeLeadStatus(normalized.status) || inferStatus({
          ...item,
          Comentários: notes,
          'Data Primeira Consulta': appointmentDate,
          Enviar: normalized.send_flag,
          Ligar: normalized.call_flag,
          discarded_flag: normalized.discarded_flag,
          scheduled_flag: normalized.scheduled_flag,
          status: normalized.status
        });

        return {
          id: String(normalized.row_number || Math.random()),
          externalId: String(normalized.row_number || '0'),
          name: String(normalized.name || 'Sem Nome'),
          phone: String(normalized.phone || ''),
          email: String(normalized.email || ''),
          timestamp,
          status,
          isContacted: status !== 'new' || !!(normalized.contact_date || normalized.owner || firstValue(normalized.call_flag)),
          notes,
          doctor: String(normalized.doctor || ''),
          appointmentDate,
          value: parseNumberValue(normalized.value)
        };
      });
  };

  const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

  const callAppsScriptAction = async (action: string, payload?: Record<string, unknown>, signal?: AbortSignal): Promise<any> => {
    const url = new URL(APPS_SCRIPT_BASE_URL);
    url.searchParams.set('action', action);
    if (payload) {
      url.searchParams.set('payload', JSON.stringify(payload));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal
    });

    const text = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Resposta inválida da API (JSON malformado).');
    }

    if (!response.ok || parsed?.ok === false) {
      throw new Error(parsed?.error || `API respondeu com HTTP ${response.status}`);
    }

    return parsed;
  };

  const fetchLeadsPayload = async (attempt: number): Promise<any[]> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const data = await callAppsScriptAction('getLeads', undefined, controller.signal);

      const payload = Array.isArray(data)
        ? data
        : (data && typeof data === 'object' && (data as any).ok === true
          ? (Array.isArray((data as any).data) ? (data as any).data : (Array.isArray((data as any).leads) ? (data as any).leads : null))
          : null);

      if (!payload) {
        const apiError = data && typeof data === 'object' && (data as any).ok === false ? String((data as any).error || 'Erro da API') : null;
        throw {
          kind: 'schema',
          message: apiError || 'Resposta válida mas em formato inesperado (esperado array, {ok:true,data:[]} ou {ok:true,leads:[]}).'
        } as FetchFailure;
      }

      const validation = schemaCheck(payload);
      if (!validation.valid) {
        throw {
          kind: 'schema',
          message: `Fonte inválida: faltam campos obrigatórios [${validation.missingRequired.join(', ')}]. Campos recebidos: [${validation.availableFields.join(', ')}]`,
          details: validation.availableFields.join(', ')
        } as FetchFailure;
      }

      return payload;
    } catch (error: any) {
      if (error?.kind) throw error as FetchFailure;
      if (error?.name === 'AbortError') {
        throw {
          kind: 'timeout',
          message: `Timeout da fonte (> ${FETCH_TIMEOUT_MS / 1000}s)`
        } as FetchFailure;
      }
      throw {
        kind: 'network',
        message: 'Falha de rede ao contactar a fonte.'
      } as FetchFailure;
    } finally {
      clearTimeout(timeoutId);
      setSyncStatusMessage(attempt <= FETCH_MAX_RETRIES ? `Sincronização: tentativa ${attempt + 1}/${FETCH_MAX_RETRIES + 1}` : null);
    }
  };

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    setIsInvalidSource(false);
    setSyncStatusMessage(`Sincronização: tentativa 1/${FETCH_MAX_RETRIES + 1}`);

    try {
      let lastError: FetchFailure | null = null;

      for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt += 1) {
        try {
          const data = await fetchLeadsPayload(attempt);
          const mappedLeads = mapDataToLeads(data);
          setLeads(mappedLeads);

          if (mappedLeads.length > 0) {
            const latestLead = mappedLeads.reduce((latest, lead) => {
              return toTimestampMs(lead.timestamp) > toTimestampMs(latest.timestamp) ? lead : latest;
            });
            const latestMs = toTimestampMs(latestLead.timestamp);
            if (Number.isFinite(latestMs)) {
              const latestDate = new Date(latestMs);
              setSelectedDate(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
            }
          }

          setSyncStatusMessage('Sincronização concluída.');
          window.setTimeout(() => setSyncStatusMessage(null), 1500);
          return;
        } catch (error: any) {
          lastError = error as FetchFailure;
          const isTransient = lastError.kind === 'network' || lastError.kind === 'timeout' || lastError.kind === 'http';
          const hasMoreAttempts = attempt < FETCH_MAX_RETRIES;

          if (!isTransient || !hasMoreAttempts) {
            break;
          }

          const backoffMs = FETCH_BACKOFF_MS * (attempt + 1);
          setSyncStatusMessage(`Fonte instável (${lastError.message}). Nova tentativa em ${Math.round(backoffMs / 1000)}s...`);
          await sleep(backoffMs);
        }
      }

      if (lastError?.kind === 'schema' || lastError?.kind === 'parse') {
        setLeads([]);
        setIsInvalidSource(true);
        setFetchError(lastError.message);
      } else {
        setFetchError(`Erro ao sincronizar com Google Sheet: ${lastError?.message || 'falha desconhecida'}`);
      }
    } catch {
      setFetchError('Erro ao carregar dados da fonte');
    } finally {
      setIsLoading(false);
      setSyncStatusMessage(null);
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
        resumo_contacto: extraData?.resumo_contacto || extraData?.comentario || updates.notes,
        medico: extraData?.medico || updates.doctor,
        data_consulta: extraData?.data_consulta || updates.appointmentDate,
        data_agendada: extraData?.data_agendada || extraData?.data_consulta || updates.appointmentDate,
        valor_fechado: extraData?.valor_fechado !== undefined ? extraData.valor_fechado : updates.value,
        descartadas: (updates.status || lead.status) === 'discarded' ? '✅' : undefined,
        agendadas: (updates.status || lead.status) === 'scheduled' ? '✅' : undefined,
        data_tratamento: formattedNow
      };

      const apiResult = await callAppsScriptAction('updateLead', payload as unknown as Record<string, unknown>);
      if (!apiResult?.ok) throw new Error('Sync falhou');
    } catch (error) {
      console.error('Failed to sync:', error);
      setFetchError(`Erro na sincronização de atualização: ${getErrorMessage(error)}`);
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

      const subject = encodeURIComponent(`Lembrete consulta - ${lead.name}`);
      const body = encodeURIComponent([
        `Olá ${lead.name},`,
        '',
        'Relembramos a sua consulta na Go Smile.',
        lead.appointmentDate ? `Data prevista: ${lead.appointmentDate}` : '',
        '',
        'Se precisar de reagendar, responda a este email ou contacte-nos.'
      ].filter(Boolean).join('\n'));

      window.open(`mailto:${lead.email}?subject=${subject}&body=${body}`, '_blank');

      await callAppsScriptAction('updateLead', {
        row_number: lead.externalId,
        comentario: `${lead.notes ? `${lead.notes}\n` : ''}[${new Date().toISOString()}] Lembrete preparado por email.`,
        status: lead.status,
        data_contacto: new Date().toISOString()
      });

      alert(`Lembrete preparado para ${lead.name}.`);
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
      {(fetchError || isSyncing || isLoading || syncStatusMessage) && (
        <div className={`px-4 py-2 text-[10px] font-bold text-center uppercase tracking-tight transition-all fixed top-[110px] left-0 right-0 z-50 shadow-md ${(isSyncing || isLoading || syncStatusMessage) ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
          {(isSyncing || isLoading) ? (syncStatusMessage || 'A sincronizar...') : fetchError}
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
