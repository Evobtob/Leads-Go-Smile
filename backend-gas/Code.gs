const SHEET_ID = '18RbQhpBsG7DpIky1hF3TvhxC31CTEC_v-cGkpa1d6PI';

const REQUIRED_FIELDS = ['name', 'phone', 'email', 'date'];

const FIELD_ALIASES = {
  row_number: ['row_number', 'row', 'id', 'lead_id', 'linha', 'line_number'],
  source: ['source', 'origem', 'canal', 'utm_source'],
  lead_quality: ['lead_quality', 'qualidade_lead', 'qualidade', 'status_lead', 'lead_status'],
  name: ['name', 'nome', 'lead_name', 'full_name', 'cliente', 'contact_name'],
  phone: ['phone', 'telefone', 'telemovel', 'celular', 'mobile', 'whatsapp', 'telefone_1'],
  email: ['email', 'e_mail', 'mail', 'email_address'],
  location: ['location', 'localizacao', 'cidade', 'regiao', 'bairro'],
  date: ['data', 'date', 'timestamp', 'created_at', '4', 'lead_created_at'],
  notes: ['comentarios', 'comentários', 'comments', 'notes', 'observacoes', 'observações'],
  contact_date: ['data_contacto', 'data contato', 'contact_date', 'contacted_at'],
  owner: ['responsavel', 'responsável', 'owner', 'responsible'],
  doctor: ['medico', 'médico', 'doctor'],
  appointment_date: ['data_primeira_consulta', 'primeira_consulta', 'appointment_date', 'consulta', 'data_consulta'],
  resumo_contacto: ['resumo_contacto', 'resumo contacto', 'resumo_de_contacto', 'resumo'],
  data_agendada: ['data_agendada', 'data agendada', 'agendada_em', 'appointment_scheduled_at'],
  value: ['valor_real_bruto', 'valor_fechado', 'valor', 'value', 'budget', 'amount'],
  status: ['status', 'estado'],
  treatment_date: ['data_tratamento', 'treatment_date']
};

const ENSURED_COLUMNS = {
  resumo_contacto: 'Resumo Contacto',
  data_agendada: 'Data Agendada'
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

    if (method === 'GET' && action === 'leads') {
      const leads = getLeads_();
      return jsonResponse({ ok: true, count: leads.length, leads: leads });
    }

    if (method === 'POST' && action === 'update') {
      const body = parseBody_(e);
      const updated = updateLead_(body);
      return jsonResponse({ ok: true, updated: updated });
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
    available.push(key);
    Object.keys(FIELD_ALIASES).forEach(function(canonical) {
      if (canonicalToIndex[canonical] !== undefined) return;
      const aliases = FIELD_ALIASES[canonical].map(normalizeKey);
      if (aliases.indexOf(key) !== -1) canonicalToIndex[canonical] = idx;
    });
  });

  return { canonicalToIndex: canonicalToIndex, available: available };
}

function getLeads_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const headers = values[0];
  const rows = values.slice(1);
  const map = getHeaderMap_(headers);

  const missing = REQUIRED_FIELDS.filter(function(field) { return map.canonicalToIndex[field] === undefined; });
  if (missing.length > 0) {
    throw new Error('Fonte inválida: faltam campos obrigatórios [' + missing.join(', ') + ']');
  }

  return rows
    .filter(function(row) {
      return row.some(function(cell) { return String(cell || '').trim() !== ''; });
    })
    .map(function(row, i) {
      const item = {};
      Object.keys(FIELD_ALIASES).forEach(function(key) {
        const idx = map.canonicalToIndex[key];
        item[key] = idx === undefined ? '' : row[idx];
      });
      item.row_number = String(i + 2);
      return item;
    });
}

function parseBody_(e) {
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
  for (var i = 0; i < headers.length; i++) {
    if (normalizedAliases.indexOf(normalizeKey(headers[i])) !== -1) return i + 1;
  }
  return -1;
}

function ensureColumns_(sheet, headers, canonicalToHeader) {
  let nextColumn = headers.length + 1;
  Object.keys(canonicalToHeader).forEach(function(canonical) {
    const existing = getColumnIndexByCanonical_(headers, canonical);
    if (existing !== -1) return;
    sheet.getRange(1, nextColumn).setValue(canonicalToHeader[canonical]);
    headers.push(canonicalToHeader[canonical]);
    nextColumn += 1;
  });
}

function updateLead_(body) {
  const rowNumber = Number(body.row_number);
  if (!rowNumber || rowNumber < 2) throw new Error('row_number inválido.');

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (rowNumber > lastRow) throw new Error('row_number fora do intervalo da folha.');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  ensureColumns_(sheet, headers, ENSURED_COLUMNS);

  const updates = {
    status: body.status || body.estado,
    notes: body.comentario || body.notes,
    doctor: body.medico || body.doctor,
    appointment_date: body.data_consulta || body.appointment_date,
    resumo_contacto: body.resumo_contacto || body.comentario || body.notes,
    data_agendada: body.data_agendada || body.data_consulta || body.appointment_date,
    value: body.valor_fechado || body.value,
    treatment_date: body.data_tratamento || new Date().toISOString(),
    contact_date: body.data_contacto || new Date().toISOString()
  };

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
    throw new Error('Nenhuma coluna compatível encontrada para atualizar.');
  }

  SpreadsheetApp.flush();
  return { row_number: rowNumber, fields: applied };
}
