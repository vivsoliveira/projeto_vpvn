// historico.js — versão que abre detalhes na MESMA PÁGINA e destaca parcelas vencidas

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

// busca no backend; se falhar, fallback para localStorage
async function fetchOperacoes(){
  try {
    const res = await fetch(`${API}/api/operacoes?limit=100`);
    if(res.ok){
      const rows = await res.json();
      return rows.map(r => {
        const payload = r.data || r.data_json || {};
        return {
          id: r.id || payload.id || null,
          nomeSocial: r.nome_social || payload.nomeSocial || payload.nome_social || '—',
          dataOperacao: payload.dataOperacao || payload.data_operacao || (payload.data && payload.data.dataOperacao) || null,
          taxaMensalPct: payload.taxaMensalPct || payload.taxa || null,
          status: payload.status || '—',
          parcelas: (payload.parcelas || payload.data?.parcelas || []).map(p => ({
            index: p.index || p.parcela || null,
            data: p.data || p.vencimento || p.date || null,
            entrada: p.entrada || p.vp || p.valor || p.valorParcela || 0,
            pv: p.pv || p.valorCalculado || 0
          })),
          created_at: r.created_at || null,
          raw: payload
        };
      });
    } else throw new Error('no-backend');
  } catch (e) {
    try {
      const raw = localStorage.getItem('operacoes') || '[]';
      const arr = JSON.parse(raw);
      return (Array.isArray(arr) ? arr : []).map((payload, i) => ({
        id: payload.id || payload._id || ('local-' + (i+1)),
        nomeSocial: payload.nomeSocial || payload.nome_social || '—',
        dataOperacao: payload.dataOperacao || payload.data_operacao || null,
        taxaMensalPct: payload.taxaMensalPct || payload.taxa || null,
        status: payload.status || '—',
        parcelas: (payload.parcelas || payload.data?.parcelas || []).map(p => ({
          index: p.index || null,
          data: p.data || p.vencimento || null,
          entrada: p.entrada || p.vp || p.valor || 0,
          pv: p.pv || 0
        })),
        created_at: payload.created_at || null,
        raw: payload
      }));
    } catch (ex){
      console.error('Erro ao ler localStorage operacoes', ex);
      return [];
    }
  }
}

function groupByCliente(ops){
  const map = new Map();
  for(const op of ops){
    const nome = (op.nomeSocial || '— sem nome —').trim();
    if(!map.has(nome)) map.set(nome, []);
    map.get(nome).push(op);
  }
  return map;
}

function renderTable(grouped){
  const tbody = document.querySelector('#histTable tbody');
  tbody.innerHTML = '';
  const tableWrap = document.getElementById('tableWrap');
  const empty = document.getElementById('empty');
  let totalDevedor = 0;

  const entries = Array.from(grouped.entries()).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
  if(entries.length === 0){
    tableWrap.style.display = 'none';
    empty.style.display = '';
    document.getElementById('totalDevedor').textContent = formatCurrency(0);
    return;
  }

  tableWrap.style.display = '';
  empty.style.display = 'none';

  for(const [nome, ops] of entries){
    let clienteNextDate = null;
    let clienteNextValue = 0;
    let clienteTotal = 0;

    ops.forEach(op => {
      const totalOp = Array.isArray(op.parcelas) && op.parcelas.length ? op.parcelas.reduce((s,p)=>s + Number(p.entrada || p.pv || 0),0) : 0;
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

    totalDevedor += clienteTotal;

    const tr = document.createElement('tr');
    const tdNome = document.createElement('td'); tdNome.textContent = nome;
    const tdNext = document.createElement('td'); tdNext.textContent = clienteNextDate ? formatDateBR(parseDateISO(clienteNextDate)) : '—';
    const tdNextVal = document.createElement('td'); tdNextVal.textContent = clienteNextValue ? formatCurrency(clienteNextValue) : '—';
    const tdTotal = document.createElement('td'); tdTotal.textContent = formatCurrency(clienteTotal);
    const tdDetails = document.createElement('td');
    const btn = document.createElement('button'); btn.textContent = 'Ver'; btn.className = 'btn-view';
    btn.addEventListener('click', ()=> openClientDetails(nome, ops));
    tdDetails.appendChild(btn);

    tr.appendChild(tdNome); tr.appendChild(tdNext); tr.appendChild(tdNextVal); tr.appendChild(tdTotal); tr.appendChild(tdDetails);
    tbody.appendChild(tr);
  }

  document.getElementById('totalDevedor').textContent = formatCurrency(totalDevedor);
}

/* ---------- INLINE details (same page) ---------- */
function openClientDetails(nome, ops){
  const container = document.getElementById('clientDetails');
  container.style.display = 'block';
  container.innerHTML = '';

  // wrapper card
  const wrapper = document.createElement('div');
  wrapper.className = 'hist-wrapper';

  const top = document.createElement('div');
  top.className = 'hist-top';
  const h2 = document.createElement('h2');
  h2.className = 'hist-title';
  h2.textContent = `Operações de ${nome}`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'back secondary';
  closeBtn.textContent = 'Fechar';
  closeBtn.style.marginLeft = 'auto';
  closeBtn.addEventListener('click', closeClientDetails);
  top.appendChild(h2);
  top.appendChild(closeBtn);
  wrapper.appendChild(top);

  const subtitle = document.createElement('p');
  subtitle.className = 'hist-sub';
  subtitle.innerHTML = `Operações registradas para <strong>${nome}</strong>. Clique em "Ver parcelas" para expandir os detalhes.`;
  wrapper.appendChild(subtitle);

  // table
  const tableWrap = document.createElement('div');
  tableWrap.className = 'hist-table-wrap';
  const table = document.createElement('table');
  table.style.width = '100%';
  table.id = 'clientOpsTable';

  const thead = document.createElement('thead');
  thead.innerHTML = `<thead>
  <tr>
    <th>Data operação</th>
    <th>Próxima parcela</th>
    <th>Valor próxima</th>
    <th class="right">Total operação</th>
    <th>Parcelas</th>
  </tr>
</thead>
`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  let totalDevedor = 0;

  ops.forEach(op => {
    const parcelas = Array.isArray(op.parcelas) ? op.parcelas : [];
    const totalOp = parcelas.reduce((s,p)=>s + Number(p.entrada || p.pv || 0),0);
    totalDevedor += totalOp;

    const hoje = new Date().toISOString().slice(0,10);
    let prox = null;
    if(parcelas.length){
      const futuros = parcelas.filter(p => p.data && p.data >= hoje).sort((a,b)=>a.data.localeCompare(b.data));
      prox = futuros.length ? futuros[0] : parcelas.slice().sort((a,b)=>a.data.localeCompare(b.data))[parcelas.length-1];
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${op.dataOperacao ? formatDateBR(op.dataOperacao) : '—'}</td>
      <td>${(prox && prox.data) ? formatDateBR(prox.data) : '—'}</td>
      <td>${(prox && (prox.entrada || prox.pv)) ? formatCurrency(prox.entrada || prox.pv) : '—'}</td>
      <td class="right">${formatCurrency(totalOp)}</td>
      <td></td>
    `;
    const btnCell = tr.querySelector('td:last-child');
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-view';
    viewBtn.textContent = 'Ver parcelas';
    // add listener to toggle parcels panel for this operation
    viewBtn.addEventListener('click', ()=> toggleParcelas(op));
    btnCell.appendChild(viewBtn);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  const tfoot = document.createElement('tfoot');
  tfoot.innerHTML = `<tr><td colspan="4">Total do devedor</td><td class="right">${formatCurrency(totalDevedor)}</td><td></td></tr>`;
  table.appendChild(tfoot);

  tableWrap.appendChild(table);
  wrapper.appendChild(tableWrap);

  container.appendChild(wrapper);
  container.scrollIntoView({ behavior: 'smooth' });
}

// fechar painel
function closeClientDetails(){
  const c = document.getElementById('clientDetails');
  if(!c) return;
  c.style.display = 'none';
  c.innerHTML = '';
}

// toggle parcelas de uma operação (adiciona/removes painel abaixo da tabela)
function toggleParcelas(op){
  const container = document.getElementById('clientDetails');
  if(!container) return;
  const opId = 'op-panel-' + (op.id || op._id || Math.random().toString(36).slice(2,8));
  // se já existe, remove
  const existing = document.getElementById(opId);
  if(existing){
    existing.remove();
    return;
  }

  const panel = document.createElement('div');
  panel.id = opId;
  panel.className = 'op-card';

  const h = document.createElement('h3');
  h.textContent = `Detalhes`;
  panel.appendChild(h);

  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `Data operação: ${op.dataOperacao || op.data || '—'} · Taxa: ${op.taxaMensalPct || op.taxa || '—'}%`;
  panel.appendChild(meta);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>#</th><th>Data</th><th>Entrada</th><th>VP</th></tr>`;
  table.appendChild(thead);

  const tb = document.createElement('tbody');
  const parcelas = Array.isArray(op.parcelas) ? op.parcelas : [];
  const today = new Date().toISOString().slice(0,10);

  if(parcelas.length){
    parcelas.forEach(p => {
      const tr = document.createElement('tr');
      const isOver = p && p.data && (p.data < today);
      if(isOver) tr.classList.add('overdue');
      tr.innerHTML = `<td style="padding:8px">${p.index || ''}</td>
                      <td style="padding:8px">${p.data ? formatDateBR(p.data) : '—'}</td>
                      <td style="padding:8px">${formatCurrency(Number(p.entrada || p.vp || p.valor || 0))}</td>
                      <td style="padding:8px">${formatCurrency(Number(p.pv || 0))}</td>`;
      tb.appendChild(tr);
    });
  } else {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" class="muted" style="padding:8px">Sem parcelas registradas</td>`;
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  panel.appendChild(table);

  container.appendChild(panel);
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- inicialização ---------- */
async function loadHistorico(){
  const loading = document.getElementById('loading');
  loading.style.display = '';
  document.getElementById('tableWrap').style.display = 'none';
  document.getElementById('empty').style.display = 'none';

  try {
    const ops = await fetchOperacoes();
    const grouped = groupByCliente(ops);
    renderTable(grouped);
  } catch (err) {
    console.error('Erro historico:', err);
    document.getElementById('empty').textContent = 'Erro ao carregar histórico (veja console).';
    document.getElementById('empty').style.display = '';
  } finally {
    loading.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', loadHistorico);
