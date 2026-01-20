// script.js — VERSÃO CORRIGIDA
// Objetivo: implementar corretamente desconto simples e parsing numérico robusto

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

// ===== FINANÇAS (taxa mensal, base 30 dias) =====
const DAYS_PER_MONTH = 30;

// desconto simples (valor absoluto)
// desconto = (taxaPercent * dias * valor) / (30 * 100)
function descontoSimples(taxaMensalPct, diasCorridos, valor){
  const taxa = Number(taxaMensalPct) || 0;
  const dias = Number(diasCorridos) || 0;
  const v = Number(valor) || 0;
  return (taxa * dias * v) / (DAYS_PER_MONTH * 100);
}

// PV a partir de VP "nominal de entrada" (desconto simples subtrativo)
function pvFromVp(vpEntrada, taxaMensalPct, diasCorridos){
  return Number(vpEntrada || 0) - descontoSimples(taxaMensalPct, diasCorridos, vpEntrada);
}

// VP a partir de VF (modo inverso): aplicar desconto simples sobre VF para obter VP
function vpFromVf(vfEntrada, taxaMensalPct, diasCorridos){
  return Number(vfEntrada || 0) - descontoSimples(taxaMensalPct, diasCorridos, vfEntrada);
}

// ===== utilitários de número/currency =====
function parseUserNumber(str){
  if(str === null || str === undefined) return NaN;
  if(typeof str === 'number') return str;
  const s = String(str).trim();
  if(s === '') return NaN;

  const hasDot = s.indexOf('.') !== -1;
  const hasComma = s.indexOf(',') !== -1;

  let normalized = s;

  // Caso: tem pontos E vírgula -> assumir ponto = separador de milhar, vírgula = decimal (pt-BR)
  if(hasDot && hasComma){
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if(hasComma && !hasDot){
    // apenas vírgula -> decimal
    normalized = s.replace(',', '.');
  } else {
    // apenas ponto (ou nenhum) -> assumir ponto como decimal (ex: "3.5" => 3.5)
    // Mas também remover espaços e símbolos de moeda
    normalized = s;
  }

  // remover qualquer caractere que não seja dígito, sinal ou ponto decimal
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
      document.getElementById('modeHelp').innerHTML =
        (modo === 'desconto')
          ? 'No modo <strong>Desconto</strong> o sistema divide o <strong>Valor total</strong> em parcelas (VP) e mostra o <strong>PV descontado</strong>.'
          : 'No modo <strong>Inverso</strong> você informa <strong>VF</strong> e vê o <strong>VP</strong>.';
      updateParcelValueLabels();
      atualizarTudo();
    });
  });

  document.getElementById('btnFillDates').addEventListener('click', fillDefaultParcelDates);
  document.getElementById('btnClearDates').addEventListener('click', clearParcelDates);
  document.getElementById('btnFillValues').addEventListener('click', fillDefaultParcelValues);
  document.getElementById('btnReset').addEventListener('click', resetForm);

  document.getElementById('operacaoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Operação pronta (veja console).');
    console.log('debug parcelas:', obterParcelasCompletas());
  });
});

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

    // Resultado:
    // - desconto: entrada = VP => mostra PV descontado (usando desconto simples subtrativo)
    // - inverso: entrada = VF => mostra VP (aplica desconto simples sobre VF)
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

  // prazo total e médio
  const ultima = parcelas.length ? parcelas[parcelas.length-1].data : null;
  const prazoTotal = ultima ? calendarDaysBetween(d0, ultima) : NaN;
  const prazoMedio = parcelas.length ? parcelas.reduce((s,p)=>s+p.dias,0) / parcelas.length : NaN;

  document.getElementById('prazoTotal').textContent = Number.isNaN(prazoTotal) ? '—' : `${round2(prazoTotal)} dias`;
  document.getElementById('prazoMedio').textContent = Number.isNaN(prazoMedio) ? '—' : `${round2(prazoMedio)} dias`;

  // soma entrada e soma PV
  const sumEntrada = round2(parcelas.reduce((s,p)=>s+p.entrada,0));
  const sumPV = round2(parcelas.reduce((s,p)=>s+p.pv,0));

  document.getElementById('sumNominal').textContent = 'R$ ' + formatCurrencyNumber(sumEntrada);
  document.getElementById('sumCalculado').textContent = 'R$ ' + formatCurrencyNumber(sumPV);

  // escreve resultados por parcela
  for(const p of parcelas){
    const resEl = document.getElementById('parcelaRes' + p.index);
    const label = (modo === 'desconto') ? 'PV' : 'VP';
    resEl.textContent = `${label}: R$ ${formatCurrencyNumber(p.pv)} — (dias corridos: ${p.dias})`;
  }

  // atualiza vencimento para última parcela
  if(ultima){
    document.getElementById('dataVencimento').value = ultima;
  }

  // status simples
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
