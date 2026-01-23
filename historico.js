const API = 'http://localhost:3000'; // se tiver backend, ok

function parseDateISO(s){
  if(!s) return null;
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if(onlyDate) return new Date(s + 'T00:00:00');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function formatDateBR(d){
  if(!d) return '—';
  if(typeof d === 'string') d = parseDateISO(d);
  if(!d) return '—';
  return d.toLocaleDateString('pt-BR');
}
function formatCurrency(n){
  if(n === null || n === undefined || Number.isNaN(n)) return 'R$ 0,00';
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

// Substitua a função fetchOperacoes existente por esta
async function fetchOperacoes(){
  const apiUrl = 'http://localhost:3000/api/operacoes'; // ajuste se for outra rota
  // helper: tenta extrair array de várias formas
  function extractArrayFromResponse(obj){
    if(!obj) return null;
    if(Array.isArray(obj)) return obj;
    // propriedades comuns que contêm arrays
    const candidates = ['data','rows','items','result','value','operacoes','operations'];
    for(const k of candidates){
      if(obj[k] && Array.isArray(obj[k])) return obj[k];
    }
    // propriedades que contém objeto com array dentro
    for(const key of Object.keys(obj)){
      if(Array.isArray(obj[key])) return obj[key];
    }
    return null;
  }

  // normaliza uma operação qualquer para a forma que o historico.js espera
  function normalizeOp(raw){
    if(!raw) return null;
    const op = {};
    // nome social: tente muitos campos
    op.nomeSocial = raw.nomeSocial || raw.nome_social || raw.nome || raw.clientName || raw.cliente || raw.customer || (raw.data && (raw.data.nomeSocial || raw.data.nome_social)) || '—';

    // dataOperacao: vários caminhos
    op.dataOperacao = raw.dataOperacao || raw.data_operacao || raw.data?.dataOperacao || raw.data?.data_operacao || raw.data || raw.created_at || raw.createdAt || null;

    // parcelas: normaliza para array de {index, data, entrada, pv}
    let parcelas = raw.parcelas || raw.installments || raw.itens || raw.details || raw.data?.parcelas || raw.data?.installments || [];
    if(!Array.isArray(parcelas)) {
      // às vezes vem como string JSON
      try { parcelas = JSON.parse(parcelas); } catch(e){ parcelas = []; }
    }
    op.parcelas = (parcelas || []).map((p, i) => {
      // p pode ter campos variados
      const dp = {};
      dp.index = p.index ?? p.parcela ?? p.n ?? (i+1);
      dp.data = p.data || p.vencimento || p.date || p.dueDate || p.venc || null;
      dp.entrada = Number(p.entrada ?? p.vp ?? p.valor ?? p.amount ?? p.value ?? p.installment ?? 0) || 0;
      dp.pv = Number(p.pv ?? p.presentValue ?? p.pvValor ?? p.calculado ?? 0) || 0;
      return dp;
    });

    // valor total: calc a partir das parcelas, ou usar campo direto
    const totalFromParcelas = op.parcelas.reduce((s,p)=> s + Number(p.entrada || 0), 0);
    op.valorTotal = Number(raw.valorTotal || raw.total || raw.amountTotal || raw.totalValue || totalFromParcelas) || totalFromParcelas || 0;

    // id se existir
    op.id = raw.id || raw._id || raw.uuid || raw.code || null;

    // manter raw inteiro caso precise
    op.__raw = raw;
    return op;
  }

  try {
    const res = await fetch(apiUrl);
    if(!res.ok){
      console.warn('fetchOperacoes: backend respondeu status', res.status);
      throw new Error('backend-status-' + res.status);
    }
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch(e) { parsed = null; }

    console.log('fetchOperacoes: resposta bruta (string, preview):', (typeof text === 'string' ? text.slice(0,2000) : text));
    if(!parsed){
      // se não for JSON, fallback para localStorage
      console.warn('fetchOperacoes: resposta não é JSON. Fallback para localStorage.');
      const raw = localStorage.getItem('operacoes') || '[]';
      try { return JSON.parse(raw); } catch(e){ return []; }
    }

    // tenta extrair array de operações
    let arr = extractArrayFromResponse(parsed);
    if(!arr && parsed.items && typeof parsed.items === 'object') arr = extractArrayFromResponse(parsed.items);
    if(!arr) {
      // se o obj parsed parece já ser uma operação única, encapsula
      if(parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 && !Array.isArray(parsed)) {
        arr = [parsed];
      }
    }
    if(!arr) {
      console.warn('fetchOperacoes: não achou array de operações no JSON recebido. Objeto recebido:', parsed);
      // fallback para localStorage
      const raw = localStorage.getItem('operacoes') || '[]';
      try { return JSON.parse(raw); } catch(e){ return []; }
    }

    // normaliza cada item
    const normalized = arr.map(a => normalizeOp(a)).filter(Boolean);
    console.log('fetchOperacoes: normalizou', normalized.length, 'operações.');
    return normalized;

  } catch(err){
    console.warn('fetchOperacoes: erro ao buscar backend, usando localStorage. Erro:', err);
    const raw = localStorage.getItem('operacoes') || '[]';
    try { return JSON.parse(raw); } catch(e){ return []; }
  }
}

function showConfirmModal(opts){
  // evita duplicar
  if(document.getElementById('confirmModal')) return;
  const root = document.createElement('div');
  root.id = 'confirmModal';
  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.display = 'flex';
  root.style.alignItems = 'center';
  root.style.justifyContent = 'center';
  root.style.zIndex = '99999';
  root.style.background = 'rgba(2,6,23,0.45)';

  const card = document.createElement('div');
  card.style.width = '520px';
  card.style.maxWidth = '92%';
  card.style.background = '#0b1220';
  card.style.color = '#fff';
  card.style.borderRadius = '12px';
  card.style.boxShadow = '0 20px 60px rgba(2,6,23,0.6)';
  card.style.padding = '22px';
  card.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
  card.style.position = 'relative';

  const title = document.createElement('div');
  title.style.fontWeight = '800';
  title.style.fontSize = '1.05rem';
  title.style.marginBottom = '10px';
  title.textContent = opts.title || 'Confirmar';

  const msg = document.createElement('div');
  msg.style.color = '#d1d5db';
  msg.style.marginBottom = '22px';
  msg.style.lineHeight = '1.45';
  msg.textContent = opts.message || '';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.justifyContent = 'flex-end';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.background = '#1f2937';
  cancelBtn.style.color = '#fff';
  cancelBtn.style.border = 'none';
  cancelBtn.style.padding = '10px 14px';
  cancelBtn.style.borderRadius = '10px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.onclick = closeConfirmModal;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = opts.confirmText || 'Confirmar';
  // estilo vermelho pro confirm
  confirmBtn.style.background = '#c02626'; // vermelho
  confirmBtn.style.color = '#fff';
  confirmBtn.style.border = 'none';
  confirmBtn.style.padding = '10px 14px';
  confirmBtn.style.borderRadius = '10px';
  confirmBtn.style.cursor = 'pointer';
  confirmBtn.style.fontWeight = '800';
  confirmBtn.onclick = function(){
    try{
      if(typeof opts.onConfirm === 'function') opts.onConfirm();
    } finally {
      closeConfirmModal();
    }
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  card.appendChild(title);
  card.appendChild(msg);
  card.appendChild(actions);
  root.appendChild(card);
  document.body.appendChild(root);

  // foco no botão confirmar por teclado
  confirmBtn.focus();
}

function closeConfirmModal(){
  const el = document.getElementById('confirmModal');
  if(el) el.remove();
}


function groupByCliente(ops){
  const map = new Map();
  for(const op of ops){
    const nome = (op.nomeSocial || op.nome_social || '— sem nome —').trim();
    if(!map.has(nome)) map.set(nome, []);
    map.get(nome).push(op);
  }
  return map;
}

function renderClientsTable(grouped){
  const tbody = document.querySelector('#histTable tbody');
  tbody.innerHTML = '';
  const tableWrap = document.getElementById('tableWrap');
  const empty = document.getElementById('empty');

  let totalDevedor = 0;

  const entries = Array.from(grouped.entries()).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
  if(entries.length === 0){
    tableWrap.style.display = 'none';
    empty.style.display = '';
    totalSummary.style.display = 'none';
    totalDevedorEl.textContent = formatCurrency(0);
    return;
  }

  tableWrap.style.display = '';
  empty.style.display = 'none';
  for(const [nome, ops] of entries){
    let clienteNextDate = null;
    let clienteNextValue = 0;
    let clienteTotal = 0;

    ops.forEach(op => {
      const totalOp = Array.isArray(op.parcelas) && op.parcelas.length
        ? op.parcelas.reduce((s,p)=>s + Number(p.entrada || p.pv || 0),0)
        : (op.valorTotal || 0);
      clienteTotal += totalOp;

      const prm = (Array.isArray(op.parcelas) && op.parcelas.length) ? op.parcelas.slice().sort((a,b)=> (a.data||'').localeCompare(b.data||'')) : [];
      let chosen = null;
      const hoje = new Date().toISOString().slice(0,10);
      if(prm.length){
        const futuros = prm.filter(p => p.data && p.data >= hoje).sort((a,b)=>a.data.localeCompare(b.data));
        chosen = futuros.length ? futuros[0] : prm[prm.length-1];
      }
      const chosenDate = chosen ? chosen.data : null;
      const chosenValor = chosen ? (Number(chosen.entrada || chosen.pv || 0)) : 0;

      if(chosenDate){
        if(!clienteNextDate || chosenDate < clienteNextDate){
          clienteNextDate = chosenDate;
          clienteNextValue = chosenValor;
        }
      }
    });

    // Se o cliente não deve nada (praticamente zero), pule e não desenhe a linha
    if (Math.abs(Number(clienteTotal) || 0) < 0.01) {
      continue;
    }

    totalDevedor += clienteTotal;

    const tr = document.createElement('tr');
    const tdNome = document.createElement('td'); tdNome.textContent = nome;
    const tdNext = document.createElement('td'); tdNext.textContent = clienteNextDate ? formatDateBR(parseDateISO(clienteNextDate)) : '—';
    const tdNextVal = document.createElement('td'); tdNextVal.textContent = clienteNextValue ? formatCurrency(clienteNextValue) : '—';
    const tdTotal = document.createElement('td'); tdTotal.innerHTML = `<strong>${formatCurrency(clienteTotal)}</strong>`;
    const tdDetails = document.createElement('td');
    const btnView = document.createElement('button'); btnView.textContent = 'Ver'; btnView.className = 'btn-view';
    btnView.addEventListener('click', ()=> openClientDetails(nome, ops));
    tdDetails.appendChild(btnView);

    const tdDelete = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-link';
    delBtn.textContent = 'Excluir';
    delBtn.title = 'Abrir detalhes para excluir operação';
    delBtn.addEventListener('click', ()=> {
      openClientDetails(nome, ops);
      setTimeout(()=> {
        const clientDetails = document.getElementById('clientDetails');
        if(clientDetails) clientDetails.scrollIntoView({behavior:'smooth', block:'center'});
      }, 200);
    });
    tdDelete.appendChild(delBtn);

    tr.appendChild(tdNome); tr.appendChild(tdNext); tr.appendChild(tdNextVal); tr.appendChild(tdTotal); tr.appendChild(tdDetails); tr.appendChild(tdDelete);
    tbody.appendChild(tr);
  }

}

function deleteOperation(op){
  // mostra modal com botão vermelho e só exclui ao confirmar
  showConfirmModal({
    title: 'Excluir operação',
    message: 'Confirmar exclusão desta operação?',
    confirmText: 'Excluir',
    onConfirm: async function(){
      try {
        // se tem id (vindo do banco de dados), deleta via API
        if(op && op.id){
          const deleteUrl = `${API}/api/operacoes/${op.id}`;
          const res = await fetch(deleteUrl, { method: 'DELETE' });
          if(!res.ok){
            alert(`Erro ao deletar: ${res.status} ${res.statusText}`);
            console.error('DELETE response:', res);
            return;
          }
          const json = await res.json();
          console.log('Operação deletada:', json);
          loadHistorico();
          return;
        }

        // fallback para localStorage (operações locais)
        const raw = localStorage.getItem('operacoes') || '[]';
        let arr = [];
        try { arr = JSON.parse(raw); } catch(e){ arr = []; }

        // procura índice por _savedAt_local (mais confiável), depois por id
        let idx = -1;
        if(op && op._savedAt_local){
          idx = arr.findIndex(o => o && o._savedAt_local === op._savedAt_local);
        }
        if(idx === -1 && op && op.id){
          idx = arr.findIndex(o => o && (o.id === op.id || o._id === op.id || (op.id && (o._id === op.id))));
        }

        if(idx >= 0){
          // remove item específico
          arr.splice(idx,1);
          localStorage.setItem('operacoes', JSON.stringify(arr));
          loadHistorico();
          return;
        }

        // fallback: remover por combinação de campos (nomeSocial + dataOperacao), pode remover apenas a primeira ocorrência
        const foundIndex = arr.findIndex(o => {
          try {
            return o && (o.nomeSocial === op.nomeSocial) && ( (o.dataOperacao || o.data_operacao || '') === (op.dataOperacao || op.data_operacao || '') );
          } catch(e){ return false; }
        });
        if(foundIndex >= 0){
          arr.splice(foundIndex,1);
          localStorage.setItem('operacoes', JSON.stringify(arr));
          loadHistorico();
          return;
        }

        // se não encontrou nada: tenta filtrar itens semelhantes (mais agressivo)
        const filtered = arr.filter(o => {
          if(!o) return true;
          if(o.nomeSocial === op.nomeSocial && (o.dataOperacao || o.data_operacao) === (op.dataOperacao || op.data_operacao)) {
            return false; // remove
          }
          return true;
        });
        // se tamanho mudou, atualiza
        if(filtered.length !== arr.length){
          localStorage.setItem('operacoes', JSON.stringify(filtered));
          loadHistorico();
          return;
        }

        // se ainda não conseguiu, avisa
        alert('Não foi possível localizar a operação para exclusão (ver console).');
        console.warn('deleteOperation: não encontrou correspondência para', op, 'em', arr);
      } catch(err){
        console.error('Erro ao excluir operação:', err);
        alert('Erro ao excluir operação (ver console).');
      }
      const details = document.getElementById('clientDetails');
      if(details){
        details.style.display = 'none';
        details.innerHTML = '';
      }
      loadHistorico();
    }
  });
}

/* ---------- INLINE details (igual versão anterior) ---------- */
function openClientDetails(nome, ops){
  const container = document.getElementById('clientDetails');
  container.style.display = 'block';
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'op-card';

  const h2 = document.createElement('h2');
  h2.textContent = `Operações de ${nome}`;
  h2.style.marginTop = '0';
  wrapper.appendChild(h2);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.textContent = `Operações registradas para ${nome}. Clique em "Excluir" na linha da parcela para remover.`;
  wrapper.appendChild(subtitle);

  // lista de operações (cada uma em seu sub-card)
  ops.forEach(op => {
    const opWrap = document.createElement('div');
    opWrap.style.padding = '12px';
    opWrap.style.borderRadius = '8px';
    opWrap.style.background = '#fff';
    opWrap.style.marginBottom = '12px';
    opWrap.style.border = '1px solid #eef6ff';

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'center';

    const title = document.createElement('div');
    title.innerHTML = `<strong>Operação</strong> · Data operação: ${op.dataOperacao || '—'} · Taxa: ${op.taxaMensalPct || op.taxa || '—'}%`;
    head.appendChild(title);

    const actions = document.createElement('div');
    const btnDeleteOp = document.createElement('button');
    btnDeleteOp.className = 'delete-link';
    btnDeleteOp.textContent = 'Excluir operação';
    btnDeleteOp.addEventListener('click', ()=> deleteOperation(op));
    actions.appendChild(btnDeleteOp);
    head.appendChild(actions);

    opWrap.appendChild(head);

    // tabela de parcelas
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '8px';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>Data</th><th>Entrada</th><th>PV</th></tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const parcelas = Array.isArray(op.parcelas) ? op.parcelas : [];
    const today = new Date().toISOString().slice(0,10);
    if(parcelas.length){
      parcelas.forEach(p => {
        const tr = document.createElement('tr');
        const isOver = p && p.data && (p.data < today);
        if(isOver) tr.classList.add('overdue');
        tr.innerHTML = `<td style="padding:8px">${p.data || '—'}</td>
                        <td style="padding:8px">${formatCurrency(Number(p.entrada || p.vp || p.valor || 0))}</td>
                        <td style="padding:8px">${formatCurrency(Number(p.pv || 0))}</td>`;
        tbody.appendChild(tr);
      });
    } else {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" class="muted" style="padding:8px">Sem parcelas registradas</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    opWrap.appendChild(table);
    wrapper.appendChild(opWrap);
  });

  // botão fechar detail
  const close = document.createElement('div');
  close.style.marginTop = '8px';
  const btnClose = document.createElement('button');
  btnClose.className = 'back secondary';
  btnClose.textContent = 'Fechar detalhes';
  btnClose.addEventListener('click', ()=> {
    container.style.display = 'none';
    container.innerHTML = '';
  });
  close.appendChild(btnClose);
  wrapper.appendChild(close);

  container.appendChild(wrapper);
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// === substitua a função loadHistorico por esta versão mais resiliente ===
async function loadHistorico(){
  const loadingEl = document.getElementById('loading');
  const tableWrapEl = document.getElementById('tableWrap');
  const emptyEl = document.getElementById('empty');

  if(loadingEl) loadingEl.style.display = '';
  if(tableWrapEl) tableWrapEl.style.display = 'none';
  if(emptyEl) emptyEl.style.display = 'none';

  // timeout wrapper para operações que podem travar (ex: fetch para localhost)
  function withTimeout(promise, ms = 8000){
    const controller = new AbortController();
    const id = setTimeout(()=> controller.abort(), ms);
    // Supondo que fetchOperacoes respeite AbortSignal (não é o caso se fetchOperacoes faz fetch internamente sem sinal).
    // Vamos usar como timeout genérico: se a promise não resolver em ms, rejeitamos.
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(()=> rej(new Error('timeout')), ms))
    ]).finally(()=> clearTimeout(id));
  }

  try {
    console.log('loadHistorico: iniciando fetchOperacoes() — (timeout 8s)');
    // envolver fetch com timeout para evitar "Carregando..." eterno
    let ops = [];
    try {
      ops = await withTimeout(fetchOperacoes(), 8000);
    } catch (errFetch) {
      console.warn('loadHistorico: fetchOperacoes falhou ou timeout:', errFetch);
      // fallback: tentar ler direto do localStorage com parsing seguro
      try {
        const raw = localStorage.getItem('operacoes') || '[]';
        ops = JSON.parse(raw);
        if(!Array.isArray(ops)) ops = [];
        console.log('loadHistorico: fallback para localStorage, ops:', ops.length);
      } catch (errLS) {
        console.error('loadHistorico: falha ao ler localStorage.operacoes:', errLS);
        ops = [];
      }
    }

    // garantir que ops seja array
    if(!Array.isArray(ops)) ops = [];

    // proteger renderização contra HTML faltante
    try {
      const grouped = groupByCliente(Array.isArray(ops) ? ops : []);
      renderClientsTable(grouped);
    } catch (errRender){
      console.error('loadHistorico: erro em renderClientsTable:', errRender);
      // mostrar mensagem amigável
      if(emptyEl){
        emptyEl.style.display = '';
        emptyEl.textContent = 'Erro ao renderizar histórico (veja console).';
      }
    }

  } catch (err) {
    console.error('loadHistorico: erro inesperado:', err);
    if(emptyEl){
      emptyEl.style.display = '';
      emptyEl.textContent = 'Erro ao carregar histórico (veja console).';
    }
  } finally {
    // garantir que o loading seja sempre escondido (evita ficar preso no "Carregando...")
    if(loadingEl) loadingEl.style.display = 'none';
    // se nada foi mostrado, garantir que o empty seja visível
    const tbody = document.querySelector('#histTable tbody');
    const tableWrap = document.getElementById('tableWrap');
    const empty = document.getElementById('empty');
    if(tableWrap && tableWrap.style.display === 'none' && empty){
      if(!empty.textContent || empty.textContent.trim() === '') empty.textContent = 'Nenhum registro encontrado.';
      empty.style.display = '';
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  loadHistorico();
  // Auto-refresh a cada 5 segundos
  setInterval(loadHistorico, 5000);
});
