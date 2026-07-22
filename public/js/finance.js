/* ==========================================================================
   FLUXO DE CAIXA — lançamentos, categorias por grupo, resumo mensal
   ========================================================================== */

let financeSelectedMonth = currentYearMonth();

function renderFinancePage() {
  const summary = getMonthSummary(financeSelectedMonth);
  const txs = transactionsInMonth(financeSelectedMonth).sort((a,b) => a.data.localeCompare(b.data));
  const months = monthOptionsAroundData();

  document.getElementById('page-financas').innerHTML = `
    <div class="section-header">
      <div><h1>Fluxo de Caixa</h1><p class="subtitle" style="margin:0;">Lançamentos de receitas e despesas por categoria</p></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div class="form-group" style="max-width:220px;margin-bottom:0;">
          <label>Mês de referência</label>
          <select id="finance-month-select" onchange="changeFinanceMonth(this.value)">
            ${months.map(m => `<option value="${m}" ${m===financeSelectedMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
        <div class="btn-row" style="margin:0;">
          <button class="btn btn-secondary" onclick="openCategoryManager()">⚙️ Categorias</button>
          <button class="btn btn-secondary" onclick="gerarRecorrentesAgora()">🔁 Gerar Recorrentes do Mês</button>
          <button class="btn btn-primary" onclick="openTransactionForm()">+ Novo Lançamento</button>
        </div>
      </div>
    </div>

    <div class="card-grid card-grid-4" style="margin-bottom:24px;">
      <div class="kpi kpi-green"><div class="kpi-label">Total de Entradas</div><div class="kpi-value">${fmt(summary.totalEntradas)}</div></div>
      <div class="kpi kpi-red"><div class="kpi-label">Total de Saídas</div><div class="kpi-value">${fmt(summary.totalSaidas)}</div></div>
      <div class="kpi ${summary.lucroLiquido>=0?'kpi-green':'kpi-red'}"><div class="kpi-label">Lucro Líquido do Mês</div><div class="kpi-value">${fmt(summary.lucroLiquido)}</div></div>
      <div class="kpi kpi-accent"><div class="kpi-label">A Receber / A Pagar</div><div class="kpi-value" style="font-size:16px;"><span class="pos">${fmt(summary.aReceber)}</span> / <span class="neg">${fmt(summary.aPagar)}</span></div></div>
    </div>

    <div class="card-grid card-grid-2" style="margin-bottom:24px;">
      <div class="card">
        <h3>Resumo por Grupo — ${monthLabel(financeSelectedMonth)}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th style="text-align:left;">Grupo</th><th>Tipo</th><th>Total</th></tr></thead>
            <tbody>${Object.keys(GROUP_META).map(g => `<tr>
              <td style="text-align:left;">${GROUP_META[g].label}</td>
              <td><span class="tag ${GROUP_META[g].tipo==='entrada'?'tag-green':'tag-red'}">${GROUP_META[g].tipo==='entrada'?'Entrada':'Saída'}</span></td>
              <td class="${GROUP_META[g].tipo==='entrada'?'pos':'neg'}" style="font-weight:700;">${fmtFull(summary.byGroup[g]?.total || 0)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h3>Entradas vs Saídas — Últimos 6 Meses</h3>
        <div class="bar-chart" id="finance-chart" style="height:140px;"></div>
        <div style="display:flex;gap:16px;margin-top:12px;font-size:11px;">
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:var(--green);border-radius:2px;display:inline-block;"></span>Entradas</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:var(--red);border-radius:2px;display:inline-block;"></span>Saídas</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Lançamentos de ${monthLabel(financeSelectedMonth)}</h3>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Data</th><th style="text-align:left;">Grupo</th><th style="text-align:left;">Categoria</th>
            <th style="text-align:left;">Descrição</th><th>Valor</th><th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody>${txs.map(transactionRow).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text2);">Nenhum lançamento neste mês.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;

  const last6 = lastNMonthKeys(6);
  renderBarChart('finance-chart', [
    { values: last6.map(m => getMonthSummary(m).totalEntradas), color: 'var(--green)' },
    { values: last6.map(m => getMonthSummary(m).totalSaidas), color: 'var(--red)' },
  ], last6.map(monthLabel), { height: 140 });
}

function transactionRow(t) {
  const isEntrada = t.tipo === 'entrada';
  const isDone = t.status === 'recebido' || t.status === 'pago';
  const label = isDone ? (isEntrada ? '✓ Recebido' : '✓ Pago') : (isEntrada ? 'A Receber' : 'A Pagar');
  const badgeCls = isDone ? 'status-ok' : (t.data < todayStr() ? 'status-overdue' : 'status-pending');
  return `<tr>
    <td>${fmtDate(t.data)}</td>
    <td style="text-align:left;">
      <select class="mini-select" onchange="updateTransactionGrupo('${t.id}', this.value)">
        ${Object.keys(GROUP_META).map(g => `<option value="${g}" ${g===t.grupo?'selected':''}>${GROUP_META[g].label}</option>`).join('')}
      </select>
    </td>
    <td style="text-align:left;">
      <select class="mini-select" onchange="updateTransactionCategoria('${t.id}', this.value)">
        ${categorySelectOptions(t.grupo, t.categoria)}
      </select>
    </td>
    <td style="text-align:left;color:var(--text2);">${escapeHtml(t.descricao || '—')}</td>
    <td class="${isEntrada?'pos':'neg'}" style="font-weight:700;">${fmtFull(t.valor)}</td>
    <td><button class="status-toggle ${badgeCls}" title="Clique para alternar" onclick="toggleTransactionStatus('${t.id}')">${label}</button></td>
    <td>
      <button class="btn-icon" title="${t.recorrente ? 'Recorrente — clique para desativar' : 'Marcar como recorrente (repete todo mês)'}" style="opacity:${t.recorrente?'1':'0.35'};" onclick="toggleTransactionRecorrente('${t.id}')">🔁</button>
      <button class="btn-icon" title="Editar" onclick="openTransactionForm('${t.id}')">✏️</button>
      <button class="btn-icon" title="Excluir" onclick="handleDeleteTransaction('${t.id}')">🗑️</button>
    </td>
  </tr>`;
}

async function toggleTransactionStatus(id) {
  const t = data.transactions.find(x => x.id === id);
  if (!t) return;
  const next = t.tipo === 'entrada'
    ? (t.status === 'recebido' ? 'a_receber' : 'recebido')
    : (t.status === 'pago' ? 'a_pagar' : 'pago');
  await updateTransaction(id, { status: next });
  showToast('Status atualizado.');
  renderFinancePage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

async function updateTransactionGrupo(id, novoGrupo) {
  const t = data.transactions.find(x => x.id === id);
  if (!t) return;
  const novoTipo = GROUP_META[novoGrupo].tipo;
  const isDone = t.status === 'recebido' || t.status === 'pago';
  await updateTransaction(id, {
    grupo: novoGrupo,
    tipo: novoTipo,
    categoria: (data.categoryGroups[novoGrupo] || [])[0] || '',
    status: novoTipo === 'entrada' ? (isDone ? 'recebido' : 'a_receber') : (isDone ? 'pago' : 'a_pagar'),
  });
  showToast('Grupo atualizado.');
  renderFinancePage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

async function updateTransactionCategoria(id, novaCategoria) {
  await updateTransaction(id, { categoria: novaCategoria });
  showToast('Categoria atualizada.');
  renderFinancePage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

async function toggleTransactionRecorrente(id) {
  const t = data.transactions.find(x => x.id === id);
  if (!t) return;
  await updateTransaction(id, { recorrente: !t.recorrente });
  showToast(t.recorrente ? 'Marcado como recorrente.' : 'Recorrência removida.');
  renderFinancePage();
}

async function gerarRecorrentesAgora() {
  const n = await ensureRecorrentesForMonth(financeSelectedMonth);
  showToast(n > 0 ? `${n} lançamento(s) recorrente(s) gerado(s) para ${monthLabel(financeSelectedMonth)}.` : 'Nenhum lançamento novo — já estava atualizado.');
  renderFinancePage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function changeFinanceMonth(val) {
  financeSelectedMonth = val;
  renderFinancePage();
}

function monthOptionsAroundData() {
  const withData = allMonthsWithData();
  const around = lastNMonthKeys(12).concat(nextNMonthKeys(3));
  const set = new Set([...withData, ...around, financeSelectedMonth]);
  return [...set].sort();
}
function nextNMonthKeys(n) {
  const keys = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const dd = new Date(d.getFullYear(), d.getMonth() + i, 1);
    keys.push(`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`);
  }
  return keys;
}

/* ---------------- Formulário de lançamento ---------------- */
function categorySelectOptions(grupo, selected) {
  return (data.categoryGroups[grupo] || []).map(c => `<option value="${escapeHtml(c)}" ${c===selected?'selected':''}>${escapeHtml(c)}</option>`).join('');
}

function openTransactionForm(id) {
  const t = id ? data.transactions.find(x => x.id === id) : {
    data: financeSelectedMonth + '-' + String(Math.min(new Date().getDate(),28)).padStart(2,'0'),
    grupo: 'receita', categoria: data.categoryGroups.receita[0], descricao: '', valor: 0,
    status: 'a_receber',
  };
  openModal(id ? 'Editar Lançamento' : 'Novo Lançamento', `
    <div class="form-grid">
      <div class="form-group"><label>Data</label><input type="date" id="f-tx-data" value="${t.data}"></div>
      <div class="form-group"><label>Grupo</label>
        <select id="f-tx-grupo" onchange="onTxGroupChange()">
          ${Object.keys(GROUP_META).map(g => `<option value="${g}" ${g===t.grupo?'selected':''}>${GROUP_META[g].label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Categoria</label>
        <select id="f-tx-categoria">${categorySelectOptions(t.grupo, t.categoria)}</select>
      </div>
      <div class="form-group"><label>Valor (R$)</label><input type="text" inputmode="decimal" id="f-tx-valor" value="${formatCurrencyValue(t.valor)}"></div>
    </div>
    <div class="form-group" style="margin-top:12px;"><label>Descrição</label><input type="text" id="f-tx-desc" value="${escapeHtml(t.descricao||'')}"></div>
    <div class="form-group" style="margin-top:12px;"><label>Status</label>
      <select id="f-tx-status">
        <option value="a_receber" ${t.status==='a_receber'?'selected':''}>A Receber</option>
        <option value="recebido" ${t.status==='recebido'?'selected':''}>Recebido</option>
        <option value="a_pagar" ${t.status==='a_pagar'?'selected':''}>A Pagar</option>
        <option value="pago" ${t.status==='pago'?'selected':''}>Pago</option>
      </select>
    </div>
    <div class="form-group" style="margin-top:12px;display:flex;align-items:center;gap:8px;">
      <input type="checkbox" id="f-tx-recorrente" style="width:auto;" ${t.recorrente?'checked':''}>
      <label style="margin:0;">🔁 Recorrente (repete automaticamente todo mês)</label>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveTransactionForm(${id ? `'${id}'` : null})">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `);
  maskCurrencyInput(document.getElementById('f-tx-valor'));
}

function onTxGroupChange() {
  const grupo = document.getElementById('f-tx-grupo').value;
  document.getElementById('f-tx-categoria').innerHTML = categorySelectOptions(grupo);
  const statusSel = document.getElementById('f-tx-status');
  statusSel.value = GROUP_META[grupo].tipo === 'entrada' ? 'a_receber' : 'a_pagar';
}

async function saveTransactionForm(id) {
  const grupo = document.getElementById('f-tx-grupo').value;
  const patch = {
    data: document.getElementById('f-tx-data').value,
    grupo,
    categoria: document.getElementById('f-tx-categoria').value,
    descricao: document.getElementById('f-tx-desc').value.trim(),
    valor: parseCurrencyValue(document.getElementById('f-tx-valor').value),
    status: document.getElementById('f-tx-status').value,
    recorrente: document.getElementById('f-tx-recorrente').checked,
  };
  if (!patch.data) { showToast('Informe a data do lançamento.', 'error'); return; }
  if (patch.valor <= 0) { showToast('Informe um valor maior que zero.', 'error'); return; }

  if (id) await updateTransaction(id, patch); else await addTransaction(patch);
  closeModal();
  showToast(id ? 'Lançamento atualizado!' : 'Lançamento criado!');
  financeSelectedMonth = monthKey(patch.data);
  renderFinancePage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function handleDeleteTransaction(id) {
  confirmAction('Excluir este lançamento?', async () => {
    await deleteTransaction(id);
    showToast('Lançamento excluído.');
    renderFinancePage();
    if (typeof refreshDashboard === 'function') refreshDashboard();
  });
}

/* ---------------- Gestão de categorias ---------------- */
function openCategoryManager() {
  openModal('Gerenciar Categorias', renderCategoryManagerBody(), { width: '640px' });
}
function renderCategoryManagerBody() {
  return Object.keys(GROUP_META).map(g => `
    <div style="margin-bottom:18px;">
      <h3 style="color:${GROUP_META[g].color};">${GROUP_META[g].label}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        ${(data.categoryGroups[g]||[]).map(c => `<span class="tag" style="background:var(--surface2);color:var(--text);display:flex;align-items:center;gap:6px;">${escapeHtml(c)}
          <span style="cursor:pointer;color:var(--red);" onclick="handleRemoveCategory('${g}','${escapeHtml(c).replace(/'/g,"\\'")}')">✕</span></span>`).join('')}
      </div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="new-cat-${g}" placeholder="Nova categoria..." style="flex:1;">
        <button class="btn btn-secondary" onclick="handleAddCategory('${g}')">+ Adicionar</button>
      </div>
    </div>
  `).join('');
}
async function handleAddCategory(group) {
  const input = document.getElementById(`new-cat-${group}`);
  const name = input.value.trim();
  if (!name) return;
  const ok = await addCategory(group, name);
  if (!ok) { showToast('Categoria já existe.', 'error'); return; }
  showToast('Categoria adicionada!');
  document.querySelector('.modal-body').innerHTML = renderCategoryManagerBody();
}
async function handleRemoveCategory(group, name) {
  const ok = await removeCategory(group, name);
  if (!ok) { showToast('Categoria em uso — não pode ser removida.', 'error'); return; }
  showToast('Categoria removida.');
  document.querySelector('.modal-body').innerHTML = renderCategoryManagerBody();
}
