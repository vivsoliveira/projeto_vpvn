// historico.js
const API = 'http://localhost:3000';

function parseDateISO(s){
  if(!s) return null;
  // aceita 'YYYY-MM-DD' ou timestamps; tenta Date parse
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if(onlyDate) return new Date(s + 'T00:00:00');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateBR(d){
  if(!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

// encontra próxima parcela a cobrar a partir de um array de parcelas (cada parcela pode ter campo 'data' ou 'date')
function nextParcelFromData(parcelas, createdAt){
  const hoje = new Date();
  // transformar datas válidas
  const dates = (Array.isArray(parcelas) ? parcelas : []).map(p => {
    return parseDateISO(p?.data || p?.date || p?.parcelaDate || p?.vencimento || '');
  }).filter(Boolean);

  if(dates.length === 0){
    // fallback: usar createdAt + 30 dias (estimativa)
    const d = new Date(createdAt);
    if(!isNaN(d.getTime())){
      d.setDate(d.getDate() + 30);
      return { date: d, note: 'estimada (sem datas)' };
    }
    return { date: null, note: 'sem datas' };
  }

  // procurar a data mais próxima >= hoje, caso contrário a próxima futura mínima
  const future = dates.filter(dt => dt >= new Date(hoje.toDateString())); // normalize to date
  if(future.length > 0){
    const soon = future.reduce((a,b) => a < b ? a : b);
    return { date: soon, note: '' };
  }
  // se todas forem passadas, retorna a mais próxima no futuro (ou a última passada)
  const nearest = dates.reduce((a,b) => Math.abs(a - hoje) < Math.abs(b - hoje) ? a : b);
  return { date: nearest, note: '(todas vencidas)' };
}

async function loadHistorico(){
  const loading = document.getElementById('loading');
  const tableWrap = document.getElementById('tableWrap');
  const tbody = document.querySelector('#histTable tbody');
  const empty = document.getElementById('empty');

  try{
    loading.style.display = '';
    tableWrap.style.display = 'none';
    empty.style.display = 'none';
    tbody.innerHTML = '';

    const res = await fetch(`${API}/api/operacoes?limit=200`);
    if(!res.ok) throw new Error('Erro ao buscar operações: ' + res.status);
    const rows = await res.json();

    if(!Array.isArray(rows) || rows.length === 0){
      empty.style.display = '';
      return;
    }

    // map and compute next parcel
    rows.forEach(op => {
      // op has: id, nome_social, data (parsedOut), created_at
      const nome = op.nome_social || (op.data && op.data.nomeSocial) || '—';
      const created = op.created_at || null;
      const parsed = op.data || {};
      const parcelas = parsed.parcelas || [];
      const next = nextParcelFromData(parcelas, created);
      const tr = document.createElement('tr');

      const tdNome = document.createElement('td');
      tdNome.textContent = nome;

      const tdNext = document.createElement('td');
      tdNext.textContent = next.date ? formatDateBR(next.date) : (next.note || '—');
      if(next.note) {
        const small = document.createElement('div');
        small.className = 'small';
        small.textContent = next.note;
        tdNext.appendChild(document.createElement('br'));
        tdNext.appendChild(small);
      }

      const tdDetail = document.createElement('td');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = 'Ver';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        alert(JSON.stringify(parsed, null, 2));
      });
      tdDetail.appendChild(a);

      tr.appendChild(tdNome);
      tr.appendChild(tdNext);
      tr.appendChild(tdDetail);
      tbody.appendChild(tr);
    });

    tableWrap.style.display = '';
  }catch(err){
    console.error(err);
    empty.textContent = 'Erro ao buscar histórico — ver console.';
    empty.style.display = '';
  }finally{
    loading.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', loadHistorico);
