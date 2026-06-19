const SHEET_ID = '1LMcABXhrGZE0fZhRSWTS0pXRmwGsruUIbs90iqUTba4';
const DISCARDED_HEADER = 'Descartadas';
const SCHEDULED_HEADER = 'Agendadas';

const REQUIRED_FIELDS = ['name', 'phone', 'email'];

const FIELD_ALIASES = {
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
  discarded_flag: ['descartadas', 'descartada', 'descartado', 'discarded_flag', 'discarded', 'lixo', 'trash'],
  scheduled_flag: ['agendadas', 'agendada', 'agendado', 'scheduled_flag', 'scheduled', 'agendamento', 'visitas'],
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

function normalizeKey(key) {
  return String(key || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'leads';

    if (method === 'GET' && action === 'health') {
      return jsonResponse({ ok: true, service: 'leads-go-smile-backend', sheetId: SHEET_ID, timestamp: new Date().toISOString() });
    }

    if (method === 'GET' && (action === 'leads' || action === 'getLeads')) {
      const leads = getLeads_();
      return jsonResponse({ ok: true, count: leads.length, data: leads, leads: leads });
    }

    if ((action === 'update' || action === 'updateLead') && (method === 'GET' || method === 'POST')) {
      const body = parseBody_(e, method);
      const updated = updateLead_(body);
      return jsonResponse({ ok: true, data: updated, updated: updated });
    }

    return jsonResponse({ ok: false, error: `Ação inválida: ${method} ${action}` });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) });
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheets()[0];
  if (!sheet) throw new Error('Nenhuma folha encontrada na spreadsheet.');
  return sheet;
}

function getHeaderMap_(headers) {
  const canonicalToIndex = {};
  const available = [];

  headers.forEach(function(header, idx) {
    const key = normalizeKey(header);
    if (!key) return;
    available.push(key);
    Object.keys(FIELD_ALIASES).forEach(function(canonical) {
      if (canonicalToIndex[canonical] !== undefined) return;
      const aliases = FIELD_ALIASES[canonical].map(normalizeKey);
      if (aliases.indexOf(key) !== -1) canonicalToIndex[canonical] = idx;
    });
  });

  const preferredDiscardedColumn = getColumnIndexByCanonical_(headers, 'discarded_flag');
  if (preferredDiscardedColumn !== -1) canonicalToIndex.discarded_flag = preferredDiscardedColumn - 1;
  const preferredScheduledColumn = getColumnIndexByCanonical_(headers, 'scheduled_flag');
  if (preferredScheduledColumn !== -1) canonicalToIndex.scheduled_flag = preferredScheduledColumn - 1;

  return { canonicalToIndex: canonicalToIndex, available: available };
}

function ensureStatusFlagHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    sheet.getRange(1, 1).setValue(DISCARDED_HEADER);
    sheet.getRange(1, 2).setValue(SCHEDULED_HEADER);
    return [DISCARDED_HEADER, SCHEDULED_HEADER];
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  let nextColumn = lastColumn + 1;

  if (getColumnIndexByCanonical_(headers, 'discarded_flag') === -1) {
    sheet.getRange(1, nextColumn).setValue(DISCARDED_HEADER);
    headers.push(DISCARDED_HEADER);
    nextColumn += 1;
  }

  if (getColumnIndexByCanonical_(headers, 'scheduled_flag') === -1) {
    sheet.getRange(1, nextColumn).setValue(SCHEDULED_HEADER);
    headers.push(SCHEDULED_HEADER);
  }

  return headers;
}

function firstValue_() {
  for (var i = 0; i < arguments.length; i++) {
    const value = String(arguments[i] === null || arguments[i] === undefined ? '' : arguments[i]).trim();
    if (value !== '') return value;
  }
  return '';
}

function parseDate_(value) {
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

function buildAppointmentDate_(item) {
  const direct = firstValue_(item.data_agendada, item.appointment_date);
  if (direct) return direct;

  const day = Number(item.appointment_day);
  const month = Number(item.appointment_month);
  const hour = Number(item.appointment_hour);
  const minute = Number(item.appointment_minute);
  if ([day, month, hour, minute].some(function(n) { return isNaN(n); })) return '';

  const leadDate = parseDate_(item.date);
  const year = leadDate ? leadDate.getFullYear() : new Date().getFullYear();
  const date = new Date(year, month - 1, day, hour, minute, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function isMarked_(value) {
  return ['x', '✓', '✔', '✅', 'sim', 'yes', 'true', '1'].indexOf(String(value || '').trim().toLowerCase()) !== -1;
}

function normalizeStatus_(value) {
  const key = normalizeKey(value);
  const aliases = {
    new: 'new', novo: 'new', nova: 'new',
    contacted: 'contacted', contactado: 'contacted', contactada: 'contacted',
    positive: 'positive', positivo: 'positive', positiva: 'positive',
    discarded: 'discarded', descartado: 'discarded', descartada: 'discarded', nao_interessada: 'discarded', nao_interessado: 'discarded',
    scheduled: 'scheduled', agendamento: 'scheduled', agendado: 'scheduled', agendada: 'scheduled', agendadas: 'scheduled', marcado: 'scheduled', marcada: 'scheduled',
    completed: 'completed', concluido: 'completed', concluida: 'completed', fechado: 'completed', fechada: 'completed', venda_fechada: 'completed',
    paid: 'paid', pago: 'paid', paga: 'paid'
  };
  return aliases[key] || '';
}

function inferStatus_(item) {
  if (isMarked_(item.discarded_flag) || isMarked_(item.descartadas) || isMarked_(item.descartada)) return 'discarded';
  if (isMarked_(item.scheduled_flag) || isMarked_(item.agendadas) || isMarked_(item.agendada)) return 'scheduled';

  const explicitStatus = normalizeStatus_(item.status || item.estado);
  if (explicitStatus) return explicitStatus;

  const notes = String(item.notes || '').toLowerCase();
  const appointment = buildAppointmentDate_(item);

  const statusMarker = notes.match(/\[status\s*:\s*(new|contacted|discarded|scheduled|positive|completed|paid)\]/i);
  if (statusMarker) return statusMarker[1].toLowerCase();

  if (notes.indexOf('pago') !== -1 || notes.indexOf('pagamento confirmado') !== -1) return 'paid';
  if (notes.indexOf('venda fechada') !== -1 || notes.indexOf('orçamento fechado') !== -1 || notes.indexOf('orcamento fechado') !== -1 || notes.indexOf('fechado no valor') !== -1) return 'completed';

  const discardKeywords = ['engano', 'não atende', 'não interessa', 'não tem interesse', 'sem interesse', 'desligou', 'longe', 'errado', 'não precisa', 'incorrecto', 'incorreto', 'falecido', 'descartad'];
  if (discardKeywords.some(function(key) { return notes.indexOf(key) !== -1; })) return 'discarded';

  if (appointment || isMarked_(item.send_flag) || notes.indexOf('marcado') !== -1 || notes.indexOf('agendado') !== -1) return 'scheduled';

  if (isMarked_(item.call_flag) || notes.indexOf('liguei') !== -1 || notes.indexOf('contactado') !== -1 || notes.indexOf('contactada') !== -1 || notes.indexOf('ligar mais tarde') !== -1) return 'contacted';
  return 'new';
}

function getLeads_() {
  const sheet = getSheet_();
  const headers = ensureStatusFlagHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, headers.length).getValues();
  const rows = values.slice(1);
  const map = getHeaderMap_(headers);

  const missing = REQUIRED_FIELDS.filter(function(field) { return map.canonicalToIndex[field] === undefined; });
  if (missing.length > 0) {
    throw new Error('Fonte inválida: faltam campos obrigatórios [' + missing.join(', ') + ']');
  }

  return rows
    .map(function(row, i) {
      const item = {};
      Object.keys(FIELD_ALIASES).forEach(function(key) {
        const idx = map.canonicalToIndex[key];
        item[key] = idx === undefined ? '' : row[idx];
      });
      item.row_number = String(i + 2);
      item.appointmentDate = buildAppointmentDate_(item);
      item.status = inferStatus_(item);
      return item;
    })
    .filter(function(item) {
      return firstValue_(item.name) && (firstValue_(item.phone) || firstValue_(item.email));
    });
}

function parseBody_(e, method) {
  if (method === 'GET') {
    const payload = e && e.parameter && e.parameter.payload;
    if (!payload) throw new Error('Payload vazio no GET.');
    try {
      return JSON.parse(payload);
    } catch (err) {
      throw new Error('JSON inválido no payload GET.');
    }
  }

  const body = e && e.postData && e.postData.contents;
  if (!body) throw new Error('Body vazio no POST.');
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new Error('JSON inválido no POST.');
  }
}

function getColumnIndexByCanonical_(headers, canonical) {
  const aliases = FIELD_ALIASES[canonical] || [canonical];
  const normalizedAliases = aliases.map(normalizeKey);
  if (canonical === 'discarded_flag') {
    for (var preferred = 0; preferred < headers.length; preferred++) {
      if (normalizeKey(headers[preferred]) === normalizeKey(DISCARDED_HEADER)) return preferred + 1;
    }
  }
  if (canonical === 'scheduled_flag') {
    for (var preferredScheduled = 0; preferredScheduled < headers.length; preferredScheduled++) {
      if (normalizeKey(headers[preferredScheduled]) === normalizeKey(SCHEDULED_HEADER)) return preferredScheduled + 1;
    }
  }
  for (var i = 0; i < headers.length; i++) {
    if (normalizedAliases.indexOf(normalizeKey(headers[i])) !== -1) return i + 1;
  }
  return -1;
}

function parseAppointmentParts_(value) {
  const date = parseDate_(value);
  if (!date) return null;
  return {
    appointment_day: date.getDate(),
    appointment_month: date.getMonth() + 1,
    appointment_hour: date.getHours(),
    appointment_minute: date.getMinutes()
  };
}

function buildStatusNote_(status, incomingNote, body) {
  const normalizedStatus = normalizeStatus_(status);
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
  const value = body && body.valor_fechado !== undefined && body.valor_fechado !== null && body.valor_fechado !== '' ? ' — valor: ' + body.valor_fechado : '';
  const marker = '[STATUS:' + normalizedStatus + '] ' + (labels[normalizedStatus] || normalizedStatus) + value;
  return note ? marker + ' — ' + note : marker;
}

function updateLead_(body) {
  const rowNumber = Number(body.row_number);
  if (!rowNumber || rowNumber < 2) throw new Error('row_number inválido.');

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (rowNumber > lastRow) throw new Error('row_number fora do intervalo da folha.');

  const headers = ensureStatusFlagHeaders_(sheet);
  const status = body.status || body.estado;
  const appointmentValue = firstValue_(body.data_agendada, body.data_consulta, body.appointment_date);
  const appointmentParts = appointmentValue ? parseAppointmentParts_(appointmentValue) : null;

  const incomingNote = firstValue_(body.comentario, body.notes, body.resumo_contacto);
  const updates = {
    notes: buildStatusNote_(status, incomingNote, body)
  };

  if (appointmentParts) {
    updates.appointment_day = appointmentParts.appointment_day;
    updates.appointment_month = appointmentParts.appointment_month;
    updates.appointment_hour = appointmentParts.appointment_hour;
    updates.appointment_minute = appointmentParts.appointment_minute;
  }

  if (normalizeStatus_(status) === 'scheduled' || appointmentValue) {
    updates.send_flag = 'X';
    updates.scheduled_flag = '✅';
  }
  if (status === 'contacted' || status === 'positive') updates.call_flag = '✅';
  if (normalizeStatus_(status) === 'discarded') {
    updates.call_flag = '✅';
    updates.discarded_flag = '✅';
  }

  const applied = {};
  Object.keys(updates).forEach(function(key) {
    const value = updates[key];
    if (value === undefined || value === null || value === '') return;
    const column = getColumnIndexByCanonical_(headers, key);
    if (column === -1) return;
    sheet.getRange(rowNumber, column).setValue(value);
    applied[key] = value;
  });

  if (Object.keys(applied).length === 0) {
    throw new Error('Nenhuma coluna existente compatível encontrada para atualizar. A folha não foi alterada.');
  }

  SpreadsheetApp.flush();
  return { row_number: rowNumber, fields: applied };
}
