// script.js — VERSÃO COM MODAL DE CONFIRMAÇÃO
// (mantive suas utilidades financeiras e funções originais e adicionei modal)

function dateFromIsoUTC(isoStr){
  return new Date(isoStr + 'T00:00:00Z');
}
function isoFromDateUTC(d){
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function calendarDaysBetween(isoStart, isoEnd){
  if(!isoStart || !isoEnd) return NaN;
  const start = dateFromIsoUTC(isoStart);
  const end = dateFromIsoUTC(isoEnd);
  if(isNaN(start.getTime()) || isNaN(end.getTime())) return NaN;
  if(end.getTime() < start.getTime()) return NaN;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function addCalendarDays(isoStart, n){
  const d = dateFromIsoUTC(isoStart);
  if(isNaN(d.getTime())) return null;
  const cur = new Date(d);
  cur.setUTCDate(cur.getUTCDate() + (Number(n) || 0));
  return isoFromDateUTC(cur);
}

function adjustToNextBusinessDay(iso){
  if(!iso) return iso;
  const d = dateFromIsoUTC(iso);
  if(isNaN(d.getTime())) return iso;
  const dow = d.getUTCDay(); // 0 dom, 6 sab
  if(dow === 6) d.setUTCDate(d.getUTCDate() + 2);
  if(dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  return isoFromDateUTC(d);
}

const DAYS_PER_MONTH = 30;
function descontoSimples(taxaMensalPct, diasCorridos, valor){
  const taxa = Number(taxaMensalPct) || 0;
  const dias = Number(diasCorridos) || 0;
  const v = Number(valor) || 0;
  return (taxa * dias * v) / (DAYS_PER_MONTH * 100);
}
function pvFromVp(vpEntrada, taxaMensalPct, diasCorridos){
  return Number(vpEntrada || 0) - descontoSimples(taxaMensalPct, diasCorridos, vpEntrada);
}
function vpFromVf(vfEntrada, taxaMensalPct, diasCorridos){
  return Number(vfEntrada || 0) - descontoSimples(taxaMensalPct, diasCorridos, vfEntrada);
}

function parseUserNumber(str){
  if(str === null || str === undefined) return NaN;
  if(typeof str === 'number') return str;
  const s = String(str).trim();
  if(s === '') return NaN;

  const hasDot = s.indexOf('.') !== -1;
  const hasComma = s.indexOf(',') !== -1;

  let normalized = s;

  if(hasDot && hasComma){
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if(hasComma && !hasDot){
    normalized = s.replace(',', '.');
  } else {
    normalized = s;
  }

  normalized = normalized.replace(/[^\d\.\-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function formatCurrencyNumber(n){
  if(n === null || n === undefined || Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function round2(n){
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function attachCurrencyFormatting(el){
  if(!el) return;
  el.addEventListener('blur', () => {
    const v = parseUserNumber(el.value);
    el.value = Number.isNaN(v) ? '' : formatCurrencyNumber(v);
    atualizarTudo();
  });
  el.addEventListener('focus', () => {
    if(el.value){
      const v = parseUserNumber(el.value);
      if(!Number.isNaN(v)) el.value = String(v);
    }
  });
}

function getModo(){
  const checked = document.querySelector('input[name="tipoDesconto"]:checked');
  return checked ? checked.value : 'desconto';
}

/* ---------- DOM ready ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // popula select de parcelas
  const sel = document.getElementById('parcelas');
  for(let i=1;i<=60;i++){
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i + (i===1 ? ' parcela' : ' parcelas');
    sel.appendChild(opt);
  }
  sel.value = '1';

  // default datas
  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0,10);
  document.getElementById('dataOperacao').value = isoHoje;
  document.getElementById('dataVencimento').value = adjustToNextBusinessDay(addCalendarDays(isoHoje, 30));

  rebuildParcelInputs();
  atualizarTudo();

  // listeners
  sel.addEventListener('change', () => { rebuildParcelInputs(); atualizarTudo(); });

  ['dataOperacao','taxa','valor','dataVencimento'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener((id === 'taxa' || id === 'valor') ? 'input' : 'change', atualizarTudo);
  });

  document.querySelectorAll('input[name="tipoDesconto"]').forEach(r => {
    r.addEventListener('change', () => {
      const modo = getModo();
      document.getElementById('modeBadge').textContent = modo === 'desconto' ? 'Modo: Desconto' : 'Modo: Inverso';
      updateParcelValueLabels();
      atualizarTudo();
    });
  });

  document.getElementById('btnFillDates').addEventListener('click', fillDefaultParcelDates);
  document.getElementById('btnClearDates').addEventListener('click', clearParcelDates);
  document.getElementById('btnFillValues').addEventListener('click', fillDefaultParcelValues);
  document.getElementById('btnReset').addEventListener('click', resetForm);
  document.getElementById('operacaoForm').addEventListener('submit', handleSubmit);

  // modal buttons
  const btnNewOp = document.getElementById('btnNewOp');
  const btnViewHistory = document.getElementById('btnViewHistory');
  const btnCloseModal = document.getElementById('btnCloseModal');
  if(btnNewOp) btnNewOp.addEventListener('click', () => { hideSaveModal(); resetForm(); focusNomeSocial(); });
  if(btnViewHistory) btnViewHistory.addEventListener('click', () => { window.location.href = 'historico.html'; });
  if(btnCloseModal) btnCloseModal.addEventListener('click', hideSaveModal);

  // Escape to close modal
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
      const modal = document.getElementById('saveModal');
      if(modal && !modal.hasAttribute('hidden')) hideSaveModal();
    }
  });
});

/* ---------- form / parcels ---------- */
function rebuildParcelInputs(){
  const n = parseInt(document.getElementById('parcelas').value || '1',10) || 1;
  const lista = document.getElementById('parcelasLista');
  lista.innerHTML = '';

  for(let i=1;i<=n;i++){
    const row = document.createElement('div');
    row.className = 'parcela-row';

    const colDate = document.createElement('div');
    colDate.className = 'col';
    const lblDate = document.createElement('label');
    lblDate.htmlFor = 'parcelaDate' + i;
    lblDate.textContent = `Parcela ${i} — data`;
    const inpDate = document.createElement('input');
    inpDate.type = 'date';
    inpDate.id = 'parcelaDate' + i;
    inpDate.addEventListener('change', () => {
      if(inpDate.value){
        const adj = adjustToNextBusinessDay(inpDate.value);
        if(adj !== inpDate.value) inpDate.value = adj;
      }
      atualizarTudo();
    });
    colDate.appendChild(lblDate);
    colDate.appendChild(inpDate);

    const colVal = document.createElement('div');
    colVal.className = 'col';
    const lblVal = document.createElement('label');
    lblVal.id = 'parcelaValorLabel' + i;
    lblVal.htmlFor = 'parcelaValor' + i;
    lblVal.textContent = `Parcela ${i} — valor`;
    const inpVal = document.createElement('input');
    inpVal.type = 'text';
    inpVal.id = 'parcelaValor' + i;
    inpVal.addEventListener('input', atualizarTudo);
    attachCurrencyFormatting(inpVal);
    colVal.appendChild(lblVal);
    colVal.appendChild(inpVal);

    const colRes = document.createElement('div');
    colRes.className = 'col resultado';
    const lblR = document.createElement('label');
    lblR.textContent = 'Resultado';
    const spanR = document.createElement('div');
    spanR.id = 'parcelaRes' + i;
    spanR.className = 'resultado';
    colRes.appendChild(lblR);
    colRes.appendChild(spanR);

    row.appendChild(colDate);
    row.appendChild(colVal);
    row.appendChild(colRes);
    lista.appendChild(row);
  }

  updateParcelValueLabels();
}

function updateParcelValueLabels(){
  const modo = getModo();
  const n = parseInt(document.getElementById('parcelas').value || '1',10) || 1;

  for(let i=1;i<=n;i++){
    const lbl = document.getElementById('parcelaValorLabel' + i);
    const inp = document.getElementById('parcelaValor' + i);
    if(!lbl || !inp) continue;

    if(modo === 'desconto'){
      lbl.textContent = `Parcela ${i} — VP (R$)`;
      inp.placeholder = 'Deixe em branco para dividir o Valor total igualmente';
    } else {
      lbl.textContent = `Parcela ${i} — VF (R$)`;
      inp.placeholder = 'Deixe em branco para dividir o Valor total igualmente';
    }
  }
}

function fillDefaultParcelDates(){
  const n = parseInt(document.getElementById('parcelas').value || '1',10) || 1;
  const d0 = document.getElementById('dataOperacao').value;
  if(!d0){ alert('Defina a Data da operação (D0) primeiro.'); return; }

  for(let i=1;i<=n;i++){
    let iso = addCalendarDays(d0, 30 * i);
    iso = adjustToNextBusinessDay(iso);
    document.getElementById('parcelaDate' + i).value = iso;
  }
  atualizarTudo();
}

function clearParcelDates(){
  const n = parseInt(document.getElementById('parcelas').value || '1',10) || 1;
  for(let i=1;i<=n;i++){
    document.getElementById('parcelaDate' + i).value = '';
  }
  atualizarTudo();
}

function fillDefaultParcelValues(){
  const n = parseInt(document.getElementById('parcelas').value || '1',10) || 1;
  const FIX_VALUE = 45000;
  for(let i=1;i<=n;i++){
    const el = document.getElementById('parcelaValor' + i);
    el.value = formatCurrencyNumber(FIX_VALUE);
  }
  atualizarTudo();
}

function obterParcelasCompletas(){
  const modo = getModo();
  const n = parseInt(document.getElementById('parcelas').value || '1',10) || 1;
  const d0 = document.getElementById('dataOperacao').value;

  const total = parseUserNumber(document.getElementById('valor').value) || 0;
  const taxa = parseUserNumber(document.getElementById('taxa').value) || 0;

  const parcelas = [];
  const share = total / n;

  for(let i=1;i<=n;i++){
    const dateEl = document.getElementById('parcelaDate' + i);
    let dt = dateEl.value?.trim();
    if(!dt){
      dt = adjustToNextBusinessDay(addCalendarDays(d0, 30 * i));
    } else {
      dt = adjustToNextBusinessDay(dt);
    }

    const dias = calendarDaysBetween(d0, dt);

    const valEl = document.getElementById('parcelaValor' + i);
    const raw = valEl.value?.trim() || '';
    const inputNum = raw === '' ? NaN : parseUserNumber(raw);

    let entrada;
    if(Number.isFinite(inputNum)){
      entrada = inputNum;
    } else {
      entrada = share; // divide igual se vazio
    }

    const pvRaw = (modo === 'desconto')
      ? pvFromVp(entrada, taxa, dias)
      : vpFromVf(entrada, taxa, dias);

    const pv = round2(pvRaw);
    parcelas.push({ index:i, data:dt, dias, entrada: round2(entrada), pv });
  }

  return parcelas;
}

function atualizarTudo(){
  const d0 = document.getElementById('dataOperacao').value;
  if(!d0) return;

  const modo = getModo();
  const parcelas = obterParcelasCompletas().sort((a,b)=>a.data.localeCompare(b.data));

  const ultima = parcelas.length ? parcelas[parcelas.length-1].data : null;
  const prazoTotal = ultima ? calendarDaysBetween(d0, ultima) : NaN;
  const prazoMedio = parcelas.length ? parcelas.reduce((s,p)=>s+p.dias,0) / parcelas.length : NaN;

  document.getElementById('prazoTotal').textContent = Number.isNaN(prazoTotal) ? '—' : `${round2(prazoTotal)} dias`;
  document.getElementById('prazoMedio').textContent = Number.isNaN(prazoMedio) ? '—' : `${round2(prazoMedio)} dias`;

  const sumEntrada = round2(parcelas.reduce((s,p)=>s+p.entrada,0));
  const sumPV = round2(parcelas.reduce((s,p)=>s+p.pv,0));

  document.getElementById('sumNominal').textContent = 'R$ ' + formatCurrencyNumber(sumEntrada);
  document.getElementById('sumCalculado').textContent = 'R$ ' + formatCurrencyNumber(sumPV);

  for(const p of parcelas){
    const resEl = document.getElementById('parcelaRes' + p.index);
    const label = (modo === 'desconto') ? 'PV' : 'VP';
    resEl.textContent = `${label}: R$ ${formatCurrencyNumber(p.pv)} — (dias corridos: ${p.dias})`;
  }

  if(ultima){
    document.getElementById('dataVencimento').value = ultima;
  }

  const total = parseUserNumber(document.getElementById('valor').value) || 0;
  const diff = round2(total - sumEntrada);

  if(Math.abs(diff) >= 0.01){
    document.getElementById('statusMsg').innerHTML =
      `<span class="warning">Atenção: soma das parcelas (R$ ${formatCurrencyNumber(sumEntrada)}) difere do Valor total (R$ ${formatCurrencyNumber(total)}).</span>`;
  } else {
    document.getElementById('statusMsg').innerHTML =
      `<span class="ok">OK — parcelas divididas igualmente.</span>`;
  }
}

function resetForm(){
  const form = document.getElementById('operacaoForm');
  form.reset();

  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0,10);
  document.getElementById('dataOperacao').value = isoHoje;
  document.getElementById('dataVencimento').value = adjustToNextBusinessDay(addCalendarDays(isoHoje, 30));

  document.getElementById('parcelas').value = '1';
  rebuildParcelInputs();
  atualizarTudo();
}

function focusNomeSocial(){
  const el = document.getElementById('nomeSocial');
  if(el){ el.focus(); }
}

/* ---------- submit + modal (substituir handleSubmit atual) ---------- */
async function handleSubmit(e){
  e.preventDefault();

  const nomeSocial = document.getElementById('nomeSocial').value.trim();
  if(!nomeSocial){
    alert('Preencha o Nome social.');
    return;
  }

  const parcelas = obterParcelasCompletas();
  const payload = {
    nomeSocial,
    modo: getModo(),
    valorTotal: parseUserNumber(document.getElementById('valor').value) || 0,
    taxaMensalPct: parseUserNumber(document.getElementById('taxa').value) || 0,
    dataOperacao: document.getElementById('dataOperacao').value,
    dataVencimento: document.getElementById('dataVencimento').value,
    parcelas,
    resumo: {
      somaNominal: document.getElementById('sumNominal').textContent,
      somaCalculado: document.getElementById('sumCalculado').textContent
    },
    // marca temporal local (útil para o histórico local)
    _savedAt_local: new Date().toISOString()
  };

  // grava localmente (sempre). Mantemos formato de array em localStorage.operacoes
  try {
    const raw = localStorage.getItem('operacoes') || '[]';
    const arr = JSON.parse(raw);
    if(Array.isArray(arr)){
      // gerar id local se não houver id do backend
      const localId = 'local-' + (Date.now()) + '-' + Math.floor(Math.random()*9000+1000);
      const toSave = Object.assign({ id: localId }, payload);
      arr.push(toSave);
      localStorage.setItem('operacoes', JSON.stringify(arr));
    } else {
      localStorage.setItem('operacoes', JSON.stringify([ payload ]));
    }
  } catch (err) {
    console.warn('Não foi possível gravar localmente:', err);
  }

  // garantir que o cliente seja incluído na lista de clientes (autocomplete)
  try {
    // adiciona em localStorage.clientes (mantido por autocomplete)
    const craw = localStorage.getItem('clientes') || '[]';
    const clients = JSON.parse(craw);
    const normalized = (nomeSocial || '').trim();
    if(Array.isArray(clients)){
      if(!clients.includes(normalized)){
        clients.push(normalized);
        clients.sort((a,b)=> a.localeCompare(b,'pt-BR'));
        localStorage.setItem('clientes', JSON.stringify(clients));
      }
    } else {
      localStorage.setItem('clientes', JSON.stringify([normalized]));
    }
    // notificar script de autocomplete (se existir)
    if(typeof window.refreshClientesAutocomplete === 'function') window.refreshClientesAutocomplete();
  } catch(ex){
    console.warn('Erro ao atualizar lista de clientes:', ex);
  }

  // tentar enviar ao backend — se der erro, já temos o registro local como fallback
  try {
    const resp = await fetch('http://localhost:3000/api/operacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      // backend respondeu erro — mantemos registro local e avisamos o usuário
      const err = await resp.json().catch(()=>({ error: 'Erro desconhecido' }));
      console.warn('API retornou erro ao salvar (gravado localmente):', err);
      showSaveModal(); // mostramos modal mesmo assim (registro está salvo localmente)
      return;
    }

    const body = await resp.json();
    console.log('Operação salva no backend:', body, payload);

    // opcional: atualizar o registro local com o id retornado pelo backend (se existir)
    try {
      const raw2 = localStorage.getItem('operacoes') || '[]';
      const arr2 = JSON.parse(raw2);
      if(Array.isArray(arr2)){
        // caso backend retorne id, associe o corpo salvo localmente ao id do backend
        if(body && (body.id || body._id)){
          // localizar pelo timestamp ou pelo nome+data
          const match = arr2.findIndex(o => o._savedAt_local === payload._savedAt_local && (o.nomeSocial === payload.nomeSocial));
          if(match >= 0){
            arr2[match] = Object.assign({}, arr2[match], body);
            localStorage.setItem('operacoes', JSON.stringify(arr2));
          } else {
            // se não achar, opcionalmente adicionar o body retornado
            arr2.push(Object.assign({}, body, { _savedAt_local: payload._savedAt_local }));
            localStorage.setItem('operacoes', JSON.stringify(arr2));
          }
        }
      }
    } catch(errUpdate){
      console.warn('Erro ao tentar sincronizar id do backend para localStorage:', errUpdate);
    }

    // mostrar modal
    showSaveModal();

  } catch (err) {
    console.error('Falha ao chamar API (gravado localmente):', err);
    // já gravamos localmente — apenas informar e abrir modal
    alert('API inacessível — operação salva localmente e aparecerá no histórico offline.');
    showSaveModal();
  }
}


/* ---------- modal helpers ---------- */
function showSaveModal(){
  const modal = document.getElementById('saveModal');
  if(!modal) return;
  modal.removeAttribute('hidden');
  // mover foco para o primeiro botão
  const btn = document.getElementById('btnNewOp') || modal.querySelector('button');
  if(btn) btn.focus();
  // impedir scroll por baixo
  document.documentElement.style.overflow = 'hidden';
}
function hideSaveModal(){
  const modal = document.getElementById('saveModal');
  if(!modal) return;
  modal.setAttribute('hidden', 'true');
  document.documentElement.style.overflow = '';
}

// AUTOCOMPLETE adaptado para usar #nomeSocial (cole no final de script.js)
(function(){
  const INPUT_ID = 'nomeSocial';
  const DROP_ID = 'clientsDropdown';
  const LS_CLIENTES = 'clientes';
  const LS_OPERACOES = 'operacoes';

  function getFromLocalStorageJSON(key){ try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; } }
  function saveToLocalStorageJSON(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }

  function extractNamesFromOperacoes(){
    const ops = getFromLocalStorageJSON(LS_OPERACOES);
    if(!Array.isArray(ops)) return [];
    const set = new Set();
    ops.forEach(o => {
      const n = (o && (o.nomeSocial || o.nome_social)) || null;
      if(n && String(n).trim()) set.add(String(n).trim());
    });
    return Array.from(set);
  }

  async function loadClientes(){
    let clientes = [];
    
    // Sempre buscar do banco de dados (fonte de verdade)
    try {
      const res = await fetch('http://localhost:3000/api/operacoes?limit=1000');
      if(res.ok){
        const ops = await res.json();
        if(Array.isArray(ops)){
          const set = new Set();
          ops.forEach(o => {
            const n = (o && (o.nome_social || o.nomeSocial)) || null;
            if(n && String(n).trim()) set.add(String(n).trim());
          });
          clientes = Array.from(set);
        }
      }
    } catch(err) {
      console.warn('Não foi possível buscar clientes do banco');
      clientes = [];
    }
    
    // Ordenar
    clientes = Array.from(new Set(clientes.map(c => String(c).trim()).filter(Boolean)));
    clientes.sort((a,b)=> a.localeCompare(b,'pt-BR'));
    return clientes;
  }

  function addClienteIfNew(nome){
    if(!nome) return;
    nome = String(nome).trim();
    if(!nome) return;
    const clientes = loadClientes();
    if(!clientes.includes(nome)){
      clientes.push(nome);
      clientes.sort((a,b)=> a.localeCompare(b,'pt-BR'));
      saveToLocalStorageJSON(LS_CLIENTES, clientes);
      if(typeof window.refreshClientesAutocomplete === 'function') window.refreshClientesAutocomplete();
    }
  }

  function renderDropdownMatches(container, matches, highlightIndex=-1){
    container.innerHTML = '';
    if(!matches || matches.length === 0){
      const no = document.createElement('div');
      no.className = 'no-results';
      no.textContent = 'Nenhum cliente';
      container.appendChild(no);
      return;
    }
    matches.forEach((name, i) => {
      const it = document.createElement('div');
      it.className = 'client-suggestion';
      if(i === highlightIndex) it.classList.add('active');
      it.setAttribute('role','option');
      it.tabIndex = 0;
      it.textContent = name;
      it.addEventListener('mousedown', function(e){
        e.preventDefault();
        setInputValue(name);
        hideDropdown(container);
        inputEl.focus();
      });
      container.appendChild(it);
    });
  }

  function filterMatches(list, term){
    term = String(term||'').trim().toLowerCase();
    if(!term) return list.slice(0,50);
    return list.filter(n => n.toLowerCase().includes(term)).slice(0,50);
  }
  function showDropdown(container){ container.style.display = ''; }
  function hideDropdown(container){ container.style.display = 'none'; }
  function setInputValue(val){ inputEl.value = val; }

  const inputEl = document.getElementById(INPUT_ID);
  const dropdown = document.getElementById(DROP_ID);
  if(!inputEl || !dropdown){ console.warn('Autocomplete: elementos não encontrados:', INPUT_ID, DROP_ID); return; }

  let clientesCache = [];
  let highlight = -1;
  
  // Carregar clientes na inicialização
  (async () => {
    clientesCache = await loadClientes();
  })();

  inputEl.addEventListener('input', async (e) => {
    const term = inputEl.value;
    clientesCache = await loadClientes();
    const matches = filterMatches(clientesCache, term);
    highlight = -1;
    renderDropdownMatches(dropdown, matches, highlight);
    showDropdown(dropdown);
  });

  inputEl.addEventListener('focus', async (e) => {
    clientesCache = await loadClientes();
    renderDropdownMatches(dropdown, clientesCache.slice(0,50));
    showDropdown(dropdown);
  });

  inputEl.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.client-suggestion');
    if(!items.length) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); highlight = Math.min(highlight + 1, items.length - 1); items.forEach((it, idx) => it.classList.toggle('active', idx === highlight)); items[highlight].scrollIntoView({block:'nearest'}); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); highlight = Math.max(highlight - 1, 0); items.forEach((it, idx) => it.classList.toggle('active', idx === highlight)); items[highlight].scrollIntoView({block:'nearest'}); }
    else if(e.key === 'Enter'){ if(highlight >= 0 && items[highlight]){ e.preventDefault(); const chosen = items[highlight].textContent; setInputValue(chosen); hideDropdown(dropdown); } }
    else if(e.key === 'Escape'){ hideDropdown(dropdown); }
  });

  inputEl.addEventListener('blur', ()=>{
    setTimeout(async ()=>{
      const v = inputEl.value && String(inputEl.value).trim();
      if(v){
        const clientsNow = await loadClientes();
        if(!clientsNow.includes(v)){
          addClienteIfNew(v);
        }
      }
      hideDropdown(dropdown);
    }, 180);
  });

  document.addEventListener('click', (e)=>{
    if(!dropdown.contains(e.target) && e.target !== inputEl){
      hideDropdown(dropdown);
    }
  });

  window.refreshClientesAutocomplete = async function(){
    clientesCache = await loadClientes();
  };

  if(inputEl.value && String(inputEl.value).trim()){
    const matches = filterMatches(clientesCache, inputEl.value);
    renderDropdownMatches(dropdown, matches);
  }
})();
