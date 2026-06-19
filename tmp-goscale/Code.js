// ============================================================
// GoScale Backend — Google Apps Script
// Stock de implantes GoSmile
// ============================================================

const SPREADSHEET_ID = '1A6iiUqVyy7r_sQ2FalrJA40q5cRM4mQzA6t4I4y_Rao';
const STOCK_SHEET_CANDIDATES = ['Stock', 'Sheet1', 'Folha1', 'Página1'];
const CIRURGIAS_SHEET = 'Cirurgias';
const PREP_EMAIL_TO = 'geral@gosmile.pt';
const PREP_EMAIL_NAME = 'Carla Pinho';

// Leads-Go-Smile bridge (robusto)
const LEADS_SHEET_ID = '1LMcABXhrGZE0fZhRSWTS0pXRmwGsruUIbs90iqUTba4';
const LEADS_REQUIRED_FIELDS = ['name', 'phone', 'email'];
const LEADS_ALIASES = {
  row_number: ['row_number', 'row', 'id', 'lead_id', 'linha', 'line_number'],
  source: ['source', 'origem', 'canal', 'utm_source'],
  lead_quality: ['lead_quality', 'qualidade_lead', 'qualidade', 'status_lead', 'lead_status'],
  name: ['name', 'nome', 'lead_name', 'full_name', 'cliente', 'contact_name'],
  phone: ['phone', 'telefone', 'telemovel', 'celular', 'mobile', 'whatsapp', 'telefone_1', 'número', 'numero'],
  email: ['email', 'e_mail', 'mail', 'email_address'],
  location: ['location', 'localizacao', 'cidade', 'regiao', 'bairro'],
  date: ['data', 'date', 'timestamp', 'created_at', '4', 'lead_created_at'],
  speciality: ['especialidade', 'speciality', 'specialty'],
  appointment_day: ['dia', 'day'],
  appointment_month: ['mês', 'mes', 'month'],
  appointment_hour: ['hora', 'hour'],
  appointment_minute: ['minuto', 'minute'],
  send_flag: ['enviar', 'send'],
  call_flag: ['ligar', 'call'],
  notes: ['notas', 'comentarios', 'comentários', 'comments', 'notes', 'observacoes', 'observações'],
  campaign: ['campanha', 'campaign'],
  ad_set: ['ad set', 'ad_set', 'adset'],
  ad: ['ad', 'anuncio', 'anúncio'],
  platform: ['plataforma', 'platform'],
  contact_date: ['data_contacto', 'data contato', 'contact_date', 'contacted_at'],
  owner: ['responsavel', 'responsável', 'owner', 'responsible'],
  doctor: ['medico', 'médico', 'doctor'],
  appointment_date: ['data_primeira_consulta', 'primeira_consulta', 'appointment_date', 'consulta', 'data_consulta'],
  data_agendada: ['data_agendada', 'data agendada', 'agendada_em', 'appointment_scheduled_at'],
  value: ['valor_real_bruto', 'valor_fechado', 'valor', 'value', 'budget', 'amount'],
  status: ['status', 'estado'],
  treatment_date: ['data_tratamento', 'treatment_date']
};

function doGet(e) {
  if (e && e.parameter && e.parameter.action) return handleApi_(e);
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('GoScale — Stock Implantes')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleApi_(e) {
  const p = e.parameter || {};
  const callback = String(p.callback || '').replace(/[^A-Za-z0-9_.$]/g, '');
  let result;
  try {
    switch (p.action) {
      case 'getStock':
        result = { ok: true, data: getStock() };
        break;
      case 'getCirurgias':
        result = { ok: true, data: getCirurgias() };
        break;
      case 'addStock':
        result = { ok: true, data: addStock(p.tamanho, p.quantidade, p.referencia) };
        break;
      case 'createCirurgia':
        result = { ok: true, data: createCirurgia(JSON.parse(p.payload || '{}')) };
        break;
      case 'undoUsedImplant':
        result = { ok: true, data: undoUsedImplant(p.cirurgiaId, p.usedIndex) };
        break;
      case 'mailHealth':
        result = { ok: true, data: { remainingDailyQuota: MailApp.getRemainingDailyQuota() } };
        break;
      case 'health':
        result = { ok: true, data: { service: 'leads-go-smile-backend', sheetId: LEADS_SHEET_ID, now: new Date().toISOString() } };
        break;
      case 'getLeads':
        result = { ok: true, data: getLeadsGoSmile_() };
        break;
      case 'debugLeadsHeaders':
        result = { ok: true, data: debugLeadsHeaders_() };
        break;
      case 'updateLead':
        result = { ok: true, data: updateLeadGoSmile_(JSON.parse(p.payload || '{}')) };
        break;
      default:
        throw new Error('Acção API desconhecida.');
    }
  } catch (err) {
    result = { ok: false, error: err && err.message ? err.message : String(err) };
  }

  const body = callback ? `${callback}(${JSON.stringify(result)});` : JSON.stringify(result);
  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function getDb_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stock = getStockSheet_(ss);
  const cirurgias = ss.getSheetByName(CIRURGIAS_SHEET) || ss.insertSheet(CIRURGIAS_SHEET);
  ensureHeaders_(stock, ['Tamanho', 'Referência', 'Quantidade']);
  ensureHeaders_(cirurgias, ['Paciente', 'Data', 'Reservados', 'Usados', 'Devolvidos', 'Estado']);
  return { ss, stock, cirurgias };
}

function getStockSheet_(ss) {
  for (const name of STOCK_SHEET_CANDIDATES) {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) return sheet;
  }
  for (const name of STOCK_SHEET_CANDIDATES) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return ss.insertSheet('Stock');
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  const current = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn())).getValues()[0];
  const isEmpty = current.every(v => String(v || '').trim() === '');
  if (isEmpty) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function makeKey_(tamanho, referencia) {
  return `${String(tamanho || '').trim()}|||${String(referencia || '').trim()}`;
}

function getStock() {
  const { stock } = getDb_();
  const lastRow = stock.getLastRow();
  if (lastRow < 2) return [];

  const data = stock.getRange(2, 1, lastRow - 1, 3).getValues();
  return data
    .filter(row => String(row[0] || '').trim())
    .map((row, idx) => {
      const tamanho = String(row[0] || '').trim();
      const referencia = String(row[1] || '').trim();
      const quantidade = Number(row[2]) || 0;
      return {
        id: makeKey_(tamanho, referencia),
        row: idx + 2,
        tamanho,
        referencia,
        quantidade,
        status: quantidade <= 0 ? 'zero' : quantidade <= 2 ? 'baixo' : 'ok'
      };
    })
    .sort((a, b) => a.tamanho.localeCompare(b.tamanho, 'pt', { numeric: true }));
}

function getCirurgias() {
  const { cirurgias } = getDb_();
  const lastRow = cirurgias.getLastRow();
  if (lastRow < 2) return [];

  const data = cirurgias.getRange(2, 1, lastRow - 1, 6).getValues();
  return data
    .filter(row => String(row[0] || '').trim() || String(row[1] || '').trim())
    .map((row, idx) => ({
      id: idx + 2,
      paciente: row[0] || '',
      data: row[1] || '',
      reservados: parseJson_(row[2], []),
      usados: parseJson_(row[3], []),
      devolvidos: parseJson_(row[4], []),
      estado: row[5] || 'concluida'
    }));
}

function parseJson_(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function addStock(tamanho, quantidade, referencia) {
  tamanho = String(tamanho || '').trim();
  referencia = String(referencia || '').trim();
  quantidade = Number(quantidade);

  if (!tamanho) throw new Error('Tamanho obrigatório.');
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade inválida.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { stock } = getDb_();
    const rows = getStockRows_(stock);
    const exact = rows.find(r => r.tamanho === tamanho && r.referencia === referencia);
    const sameSizeNoRef = rows.find(r => r.tamanho === tamanho && (!referencia || !r.referencia));
    const match = exact || sameSizeNoRef;

    if (match) {
      stock.getRange(match.row, 2).setValue(referencia || match.referencia || '');
      stock.getRange(match.row, 3).setValue(match.quantidade + quantidade);
      return { ok: true, action: 'updated' };
    }

    stock.appendRow([tamanho, referencia, quantidade]);
    return { ok: true, action: 'created' };
  } finally {
    lock.releaseLock();
  }
}

function createCirurgia(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload inválido.');

  const paciente = String(payload.paciente || '').trim();
  const dataCirurgia = String(payload.data || '').trim();
  const itens = Array.isArray(payload.itens) ? payload.itens : [];

  if (!paciente) throw new Error('Paciente obrigatório.');
  if (!dataCirurgia) throw new Error('Data obrigatória.');
  if (!itens.length) throw new Error('Sem implantes seleccionados.');

  const usados = itens.filter(i => i.status === 'usado');
  const devolvidos = itens.filter(i => i.status === 'devolvido');
  assertMailAuthorized_();

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { stock, cirurgias } = getDb_();
    const rows = getStockRows_(stock);

    const usageByKey = new Map();
    usados.forEach(item => {
      const key = makeKey_(item.tamanho, item.referencia);
      usageByKey.set(key, (usageByKey.get(key) || 0) + 1);
    });

    usageByKey.forEach((qty, key) => {
      const row = rows.find(r => makeKey_(r.tamanho, r.referencia) === key);
      if (!row) throw new Error(`Implante não encontrado: ${key.replace('|||', ' / ')}`);
      if (row.quantidade < qty) throw new Error(`Stock insuficiente: ${row.tamanho} (${row.quantidade} disponível, ${qty} pedido).`);
    });

    usageByKey.forEach((qty, key) => {
      const row = rows.find(r => makeKey_(r.tamanho, r.referencia) === key);
      stock.getRange(row.row, 3).setValue(row.quantidade - qty);
    });

    cirurgias.appendRow([
      paciente,
      dataCirurgia,
      JSON.stringify(itens),
      JSON.stringify(usados),
      JSON.stringify(devolvidos),
      'concluida'
    ]);

    sendPreparationEmail_(paciente, dataCirurgia, itens, usados, devolvidos);

    return { ok: true, usados: usados.length, devolvidos: devolvidos.length, emailSent: true };
  } finally {
    lock.releaseLock();
  }
}

function undoUsedImplant(cirurgiaId, usedIndex) {
  const rowNumber = Number(cirurgiaId);
  const index = Number(usedIndex);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error('Cirurgia inválida.');
  if (!Number.isInteger(index) || index < 0) throw new Error('Implante inválido.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { stock, cirurgias } = getDb_();
    if (rowNumber > cirurgias.getLastRow()) throw new Error('Cirurgia não encontrada.');

    const reservados = parseJson_(cirurgias.getRange(rowNumber, 3).getValue(), []);
    const usados = parseJson_(cirurgias.getRange(rowNumber, 4).getValue(), []);
    const devolvidos = parseJson_(cirurgias.getRange(rowNumber, 5).getValue(), []);
    if (!Array.isArray(usados) || index >= usados.length) throw new Error('Implante já não está marcado como usado.');

    const item = usados.splice(index, 1)[0];
    const tamanho = String(item && item.tamanho || '').trim();
    const referencia = String(item && item.referencia || '').trim();
    if (!tamanho) throw new Error('Implante sem tamanho válido.');

    const returnedItem = { ...item, status: 'devolvido' };
    devolvidos.push(returnedItem);

    let changedReserved = false;
    if (Array.isArray(reservados)) {
      const match = reservados.find(i =>
        i && i.status === 'usado' &&
        String(i.tamanho || '').trim() === tamanho &&
        String(i.referencia || '').trim() === referencia
      );
      if (match) {
        match.status = 'devolvido';
        changedReserved = true;
      }
    }

    const rows = getStockRows_(stock);
    const existing = rows.find(r => r.tamanho === tamanho && r.referencia === referencia)
      || rows.find(r => r.tamanho === tamanho && (!referencia || !r.referencia));
    if (existing) {
      stock.getRange(existing.row, 2).setValue(referencia || existing.referencia || '');
      stock.getRange(existing.row, 3).setValue(existing.quantidade + 1);
    } else {
      stock.appendRow([tamanho, referencia, 1]);
    }

    if (changedReserved) cirurgias.getRange(rowNumber, 3).setValue(JSON.stringify(reservados));
    cirurgias.getRange(rowNumber, 4).setValue(JSON.stringify(usados));
    cirurgias.getRange(rowNumber, 5).setValue(JSON.stringify(devolvidos));

    return { ok: true, tamanho, referencia };
  } finally {
    lock.releaseLock();
  }
}

function assertMailAuthorized_() {
  MailApp.getRemainingDailyQuota();
}

function sendPreparationEmail_(paciente, dataCirurgia, itens, usados, devolvidos) {
  const dateLabel = formatDatePt_(dataCirurgia);
  const selected = groupEmailItems_(itens);
  const usedCount = usados.length;
  const returnedCount = devolvidos.length;
  const subject = `Preparar implantes — ${paciente} — ${dateLabel}`;
  const rowsHtml = selected.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827;">${escapeEmailHtml_(item.tamanho)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeEmailHtml_(item.referencia || 'sem referência')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:800;color:#111827;">${item.quantidade}</td>
    </tr>`).join('');
  const listText = selected.map(item => `- ${item.quantidade} × ${item.tamanho}${item.referencia ? ` — ref. ${item.referencia}` : ''}`).join('\n');

  const htmlBody = `
  <div style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,.08);">
        <div style="padding:22px 24px;background:linear-gradient(135deg,#0a84ff,#111827);color:#fff;">
          <div style="font-size:13px;font-weight:700;opacity:.82;letter-spacing:.04em;text-transform:uppercase;">GoSmile · GoScale</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.15;">Preparar implantes para cirurgia</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.45;">Carla, por favor preparar os implantes abaixo para a cirurgia.</p>
          <div style="display:grid;gap:10px;margin:0 0 20px;">
            <div style="padding:14px 16px;background:#f9fafb;border:1px solid #eef0f3;border-radius:16px;"><strong>Paciente:</strong> ${escapeEmailHtml_(paciente)}</div>
            <div style="padding:14px 16px;background:#f9fafb;border:1px solid #eef0f3;border-radius:16px;"><strong>Data:</strong> ${escapeEmailHtml_(dateLabel)}</div>
          </div>
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <thead>
              <tr style="background:#f3f4f6;color:#4b5563;font-size:12px;text-transform:uppercase;letter-spacing:.04em;">
                <th align="left" style="padding:10px 12px;">Tamanho</th>
                <th align="left" style="padding:10px 12px;">Referência</th>
                <th align="center" style="padding:10px 12px;">Qtd.</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="margin-top:18px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;color:#9a3412;font-size:14px;line-height:1.4;">
            Confirmar fisicamente os implantes antes da cirurgia. Registo GoScale: ${itens.length} seleccionados; ${usedCount} marcados como usados; ${returnedCount} devolvidos.
          </div>
          <p style="margin:22px 0 0;color:#6b7280;font-size:13px;line-height:1.45;">Email automático gerado pela app GoScale.</p>
        </div>
      </div>
    </div>
  </div>`;

  const plainBody = `Carla,\n\nPor favor preparar os implantes abaixo para a cirurgia.\n\nPaciente: ${paciente}\nData: ${dateLabel}\n\nImplantes:\n${listText}\n\nConfirmar fisicamente os implantes antes da cirurgia.\n\nEmail automático gerado pela app GoScale.`;

  MailApp.sendEmail({
    to: PREP_EMAIL_TO,
    name: 'GoScale',
    subject,
    body: plainBody,
    htmlBody
  });
}

function groupEmailItems_(items) {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    const tamanho = String(item && item.tamanho || '').trim();
    const referencia = String(item && item.referencia || '').trim();
    if (!tamanho) return;
    const key = makeKey_(tamanho, referencia);
    if (!map.has(key)) map.set(key, { tamanho, referencia, quantidade: 0 });
    map.get(key).quantidade += 1;
  });
  return [...map.values()].sort((a, b) => a.tamanho.localeCompare(b.tamanho, 'pt', { numeric: true }));
}

function formatDatePt_(value) {
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (isNaN(date.getTime())) return String(value || '—');
  return Utilities.formatDate(date, 'Europe/Lisbon', 'dd/MM/yyyy');
}

function escapeEmailHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function getStockRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 3).getValues()
    .map((row, idx) => ({
      row: idx + 2,
      tamanho: String(row[0] || '').trim(),
      referencia: String(row[1] || '').trim(),
      quantidade: Number(row[2]) || 0
    }))
    .filter(r => r.tamanho);
}

// Backwards-compatible helpers from previous UI.
function updateStock(tamanho, delta) {
  const payload = {
    paciente: 'Movimento manual',
    data: new Date().toISOString().slice(0, 10),
    itens: Number(delta) < 0 ? [{ tamanho, referencia: '', status: 'usado' }] : []
  };
  if (Number(delta) > 0) return addStock(tamanho, Number(delta), '');
  return createCirurgia(payload);
}

function authorizeOnce() {
  const { ss, stock, cirurgias } = getDb_();
  return {
    ok: true,
    spreadsheet: ss.getName(),
    stockRows: stock.getLastRow(),
    cirurgiasRows: cirurgias.getLastRow(),
    mailQuota: MailApp.getRemainingDailyQuota()
  };
}

function normalizeLeadKey_(key) {
  return String(key || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getLeadsSheet_() {
  const ss = SpreadsheetApp.openById(LEADS_SHEET_ID);
  const sheet = ss.getSheets()[0];
  if (!sheet) throw new Error('Nenhuma folha encontrada na sheet de leads.');
  return sheet;
}

function findLeadColumn_(headers, canonical) {
  const aliases = (LEADS_ALIASES[canonical] || [canonical]).map(normalizeLeadKey_);
  for (let i = 0; i < headers.length; i++) {
    if (aliases.includes(normalizeLeadKey_(headers[i]))) return i + 1;
  }
  return -1;
}

function firstLeadValue_() {
  for (let i = 0; i < arguments.length; i++) {
    const value = String(arguments[i] === null || arguments[i] === undefined ? '' : arguments[i]).trim();
    if (value !== '') return value;
  }
  return '';
}

function parseLeadDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;
  const text = String(value || '').trim();
  if (!text) return null;
  const nativeDate = new Date(text);
  if (!isNaN(nativeDate.getTime())) return nativeDate;
  const match = text.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
  if (!match) return null;
  const p1 = match[1], p2 = match[2], p3 = match[3];
  const year = p1.length === 4 ? Number(p1) : Number(p3);
  const month = Number(p2);
  const day = p1.length === 4 ? Number(p3) : Number(p1);
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

function buildLeadAppointmentDate_(item) {
  const direct = firstLeadValue_(item.data_agendada, item.appointment_date);
  if (direct) return direct;

  const day = Number(item.appointment_day);
  const month = Number(item.appointment_month);
  const hour = Number(item.appointment_hour);
  const minute = Number(item.appointment_minute);
  if ([day, month, hour, minute].some((n) => isNaN(n))) return '';

  const leadDate = parseLeadDate_(item.date);
  const year = leadDate ? leadDate.getFullYear() : new Date().getFullYear();
  const date = new Date(year, month - 1, day, hour, minute, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function isLeadMarked_(value) {
  return ['x', '✓', '✔', '✅', 'sim', 'yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());
}

function normalizeLeadStatusValue_(value) {
  const key = normalizeLeadKey_(value);
  const aliases = {
    new: 'new', novo: 'new', nova: 'new',
    contacted: 'contacted', contactado: 'contacted', contactada: 'contacted',
    positive: 'positive', positivo: 'positive', positiva: 'positive',
    discarded: 'discarded', descartado: 'discarded', descartada: 'discarded', nao_interessada: 'discarded', nao_interessado: 'discarded',
    scheduled: 'scheduled', agendado: 'scheduled', agendada: 'scheduled', marcado: 'scheduled', marcada: 'scheduled',
    completed: 'completed', concluido: 'completed', concluida: 'completed', fechado: 'completed', fechada: 'completed', venda_fechada: 'completed',
    paid: 'paid', pago: 'paid', paga: 'paid'
  };
  return aliases[key] || '';
}

function inferLeadStatus_(item) {
  const explicitStatus = normalizeLeadStatusValue_(item.status || item.estado);
  if (explicitStatus) return explicitStatus;

  const notes = String(item.notes || '').toLowerCase();
  const appointment = buildLeadAppointmentDate_(item);

  const statusMarker = notes.match(/\[status\s*:\s*(new|contacted|discarded|scheduled|positive|completed|paid)\]/i);
  if (statusMarker) return statusMarker[1].toLowerCase();

  if (notes.indexOf('pago') !== -1 || notes.indexOf('pagamento confirmado') !== -1) return 'paid';
  if (notes.indexOf('venda fechada') !== -1 || notes.indexOf('orçamento fechado') !== -1 || notes.indexOf('orcamento fechado') !== -1 || notes.indexOf('fechado no valor') !== -1) return 'completed';

  const discardKeywords = ['engano', 'não atende', 'não interessa', 'não tem interesse', 'sem interesse', 'desligou', 'longe', 'errado', 'não precisa', 'incorrecto', 'incorreto', 'falecido', 'descartad'];
  if (discardKeywords.some((key) => notes.indexOf(key) !== -1)) return 'discarded';

  if (appointment || isLeadMarked_(item.send_flag) || notes.indexOf('marcado') !== -1 || notes.indexOf('agendado') !== -1) return 'scheduled';

  if (isLeadMarked_(item.call_flag) || notes.indexOf('liguei') !== -1 || notes.indexOf('contactado') !== -1 || notes.indexOf('contactada') !== -1 || notes.indexOf('ligar mais tarde') !== -1) return 'contacted';
  return 'new';
}

function getLeadsGoSmile_() {
  const sheet = getLeadsSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const rows = data.slice(1);
  const missing = LEADS_REQUIRED_FIELDS.filter((f) => findLeadColumn_(headers, f) === -1);
  if (missing.length) throw new Error(`Fonte inválida: faltam campos obrigatórios [${missing.join(', ')}]`);

  return rows
    .map((row, idx) => {
      const item = { row_number: String(idx + 2) };
      Object.keys(LEADS_ALIASES).forEach((key) => {
        if (key === 'row_number') return;
        const col = findLeadColumn_(headers, key);
        item[key] = col === -1 ? '' : row[col - 1];
      });
      item.appointmentDate = buildLeadAppointmentDate_(item);
      item.status = inferLeadStatus_(item);
      return item;
    })
    .filter((item) => firstLeadValue_(item.name) && (firstLeadValue_(item.phone) || firstLeadValue_(item.email)));
}

function debugLeadsHeaders_() {
  const sheet = getLeadsSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const mapped = {};
  Object.keys(LEADS_ALIASES).forEach((key) => {
    mapped[key] = findLeadColumn_(headers, key);
  });
  return {
    sheetId: LEADS_SHEET_ID,
    headers: headers,
    normalized: headers.map(normalizeLeadKey_),
    mapped: mapped
  };
}

function parseLeadAppointmentParts_(value) {
  const date = parseLeadDate_(value);
  if (!date) return null;
  return {
    appointment_day: date.getDate(),
    appointment_month: date.getMonth() + 1,
    appointment_hour: date.getHours(),
    appointment_minute: date.getMinutes()
  };
}

function buildLeadStatusNote_(status, incomingNote, payload) {
  const normalizedStatus = normalizeLeadStatusValue_(status);
  const note = String(incomingNote || '').trim();
  if (!normalizedStatus) return note;

  const labels = {
    contacted: 'Contactada',
    discarded: 'Descartada',
    scheduled: 'Agendada',
    completed: 'Venda fechada',
    paid: 'Pagamento confirmado',
    positive: 'Positiva',
    new: 'Nova'
  };
  const value = payload && payload.valor_fechado !== undefined && payload.valor_fechado !== null && payload.valor_fechado !== '' ? ' — valor: ' + payload.valor_fechado : '';
  const marker = '[STATUS:' + normalizedStatus + '] ' + (labels[normalizedStatus] || normalizedStatus) + value;
  return note ? marker + ' — ' + note : marker;
}

function updateLeadGoSmile_(payload) {
  const rowNumber = Number(payload.row_number);
  if (!rowNumber || rowNumber < 2) throw new Error('row_number inválido.');

  const sheet = getLeadsSheet_();
  if (rowNumber > sheet.getLastRow()) throw new Error('row_number fora do intervalo.');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const status = payload.status || payload.estado;
  const appointmentValue = firstLeadValue_(payload.data_agendada, payload.data_consulta, payload.appointment_date);
  const appointmentParts = appointmentValue ? parseLeadAppointmentParts_(appointmentValue) : null;
  const incomingNote = firstLeadValue_(payload.comentario, payload.notes, payload.resumo_contacto);
  const updates = {
    notes: buildLeadStatusNote_(status, incomingNote, payload)
  };

  if (appointmentParts) {
    updates.appointment_day = appointmentParts.appointment_day;
    updates.appointment_month = appointmentParts.appointment_month;
    updates.appointment_hour = appointmentParts.appointment_hour;
    updates.appointment_minute = appointmentParts.appointment_minute;
  }

  if (status === 'scheduled' || appointmentValue) updates.send_flag = 'X';
  if (status === 'contacted' || status === 'positive') updates.call_flag = '✅';
  if (normalizeLeadStatusValue_(status) === 'discarded') updates.call_flag = '✅';

  const applied = {};
  Object.keys(updates).forEach((key) => {
    const value = updates[key];
    if (value === undefined || value === null || value === '') return;
    const col = findLeadColumn_(headers, key);
    if (col === -1) return;
    sheet.getRange(rowNumber, col).setValue(value);
    applied[key] = value;
  });

  if (!Object.keys(applied).length) throw new Error('Nenhuma coluna existente compatível encontrada para atualizar. A folha não foi alterada.');
  SpreadsheetApp.flush();
  return { row_number: rowNumber, fields: applied };
}
