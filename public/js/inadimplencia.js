/* ==========================================================================
   INADIMPLÊNCIA — controle de pagamento por aluno com toggle de um clique
   e régua de cobrança (e-mail / WhatsApp / copiar mensagem)
   ========================================================================== */

let inadimplenciaSelectedMonth = currentYearMonth();

function initials(nome) {
  const parts = (nome || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

async function renderInadimplenciaPage() {
  const list = await getInadimplenciaList(inadimplenciaSelectedMonth);
  const pagos = list.filter(l => l.situacao === 'pago');
  const pendentes = list.filter(l => l.situacao === 'pendente');
  const atrasados = list.filter(l => l.situacao === 'atrasado');
  // Pelos lançamentos reais (um aluno pode ter parte paga e parte em aberto)
  const totalRecebido = list.reduce((s,l) => s + l.recebido, 0);
  const totalPendente = pendentes.reduce((s,l) => s + l.emAberto, 0);
  const totalAtrasado = atrasados.reduce((s,l) => s + l.emAberto, 0);
  const outros = entradasForaDaCobranca(inadimplenciaSelectedMonth);
  const outrosRecebido = outros.filter(t => t.status === 'recebido').reduce((s,t) => s + t.valor, 0);
  const outrosAReceber = outros.filter(t => t.status !== 'recebido').reduce((s,t) => s + t.valor, 0);
  const totalAReceber = totalPendente + totalAtrasado + outrosAReceber;
  const months = monthOptionsAroundData();

  document.getElementById('page-inadimplencia').innerHTML = `
    <div class="section-header">
      <div><h1>Cobrança</h1><p class="subtitle" style="margin:0;">Controle de pagamento das mensalidades — clique no status para marcar como pago</p></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div class="form-group" style="max-width:220px;margin-bottom:0;">
          <label>Mês de referência</label>
          <select id="inad-month-select" onchange="changeInadimplenciaMonth(this.value)">
            ${months.map(m => `<option value="${m}" ${m===inadimplenciaSelectedMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary" onclick="openCobrancaTemplatesManager()">⚙️ Modelos de Cobrança</button>
      </div>
    </div>

    <div class="card-grid card-grid-4" style="margin-bottom:24px;">
      <div class="kpi kpi-green"><div class="kpi-label">Pago</div><div class="kpi-value">${fmt(totalRecebido)}</div><div class="kpi-sub">${pagos.length} aluno(s)</div></div>
      <div class="kpi kpi-yellow"><div class="kpi-label">Pendente (a vencer)</div><div class="kpi-value">${fmt(totalPendente)}</div><div class="kpi-sub">${pendentes.length} aluno(s)</div></div>
      <div class="kpi kpi-red"><div class="kpi-label">Atrasado</div><div class="kpi-value">${fmt(totalAtrasado)}</div><div class="kpi-sub">${atrasados.length} aluno(s)</div></div>
      <div class="kpi kpi-accent"><div class="kpi-label">Taxa de Adimplência</div><div class="kpi-value">${list.length ? ((pagos.length/list.length)*100).toFixed(0) : 0}%</div><div class="kpi-sub">${pagos.length}/${list.length} em dia</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <h3 style="margin-bottom:4px;">Conferência com o Dashboard</h3>
      <p style="color:var(--text2);font-size:12.5px;margin-bottom:12px;">Os números do Dashboard somam todas as entradas do mês. Aqui você vê de onde cada valor vem.</p>
      <div style="display:grid;gap:10px;">
        ${[['Recebido', totalRecebido, outrosRecebido, ''], ['A receber', totalPendente + totalAtrasado, outrosAReceber, totalAReceber > 0 ? 'color:var(--yellow);' : '']].map(([rot, mens, outras, estilo]) => `
        <div style="display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;background:var(--surface2);border-radius:10px;padding:10px 14px;">
          <strong>${rot}</strong>
          <span style="color:var(--text2);font-size:13px;">${fmtFull(mens)} de mensalidades + ${fmtFull(outras)} de outras entradas</span>
          <strong style="font-size:16px;${estilo}">= ${fmtFull(mens + outras)}</strong>
        </div>`).join('')}
      </div>
    </div>

    ${outros.length ? `<div class="card" style="margin-bottom:20px;">
      <h3 style="margin-bottom:4px;">Outras entradas de ${monthLabel(inadimplenciaSelectedMonth)}</h3>
      <p style="color:var(--text2);font-size:12.5px;margin-bottom:12px;">Matrículas, vendas avulsas e mensalidades de quem não está mais ativo. Marque como recebido ou exclua o que não existe mais.</p>
      <div class="table-wrap table-responsive-cards"><table>
        <thead><tr><th style="text-align:left;">Descrição</th><th style="text-align:left;">Categoria</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>${outros.map(outraEntradaRow).join('')}</tbody>
      </table></div>
    </div>` : ''}

    <div class="card">
      <h3>Alunos — ${monthLabel(inadimplenciaSelectedMonth)}</h3>
      <div class="table-wrap table-responsive-cards">
        <table>
          <thead><tr>
            <th style="text-align:left;">Aluno</th><th style="text-align:left;">Turma</th><th>Valor</th><th>Vencimento</th><th>Situação</th><th>Cobrança</th>
          </tr></thead>
          <tbody>${list.map(inadimplenciaRow).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--text2);">Nenhum aluno com mensalidade cadastrada.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

function inadimplenciaRow(item) {
  const { student: s, tx, situacao, diasAtraso } = item;
  let badgeCls = 'status-pending', badgeLabel = 'Pendente';
  if (situacao === 'pago') { badgeCls = 'status-ok'; badgeLabel = '✓ Pago'; }
  else if (situacao === 'atrasado') { badgeCls = 'status-overdue'; badgeLabel = `Atrasado ${diasAtraso}d`; }

  return `<tr>
    <td data-label="Aluno" style="text-align:left;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="avatar">${initials(s.nome)}</div>
        <div>
          <div style="font-weight:600;">${escapeHtml(s.nome)}</div>
          <div style="font-size:11px;color:var(--text2);">${escapeHtml(s.categoria)}</div>
        </div>
      </div>
    </td>
    <td data-label="Turma" style="text-align:left;">${escapeHtml(s.turma || '—')}</td>
    <td data-label="Valor">${fmtFull(item.valor)}${item.qtd > 1 ? `<div style="font-size:11px;color:var(--yellow);" title="Há mais de um lançamento de mensalidade deste aluno neste mês. Veja em Fluxo de Caixa.">${item.qtd} lançamentos</div>` : ''}</td>
    <td data-label="Vencimento">${tx ? fmtDate(tx.data) : '—'}</td>
    <td data-label="Situação"><button class="status-toggle ${badgeCls}" onclick="toggleMensalidadeStatus('${s.id}')" title="Clique para alternar">${badgeLabel}</button></td>
    <td data-label="Cobrança">${situacao === 'pago'
      ? '<span style="color:var(--text2);font-size:12px;">—</span>'
      : `<button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="openCobrancaModal('${s.id}')">📨 Cobrar</button>`}</td>
  </tr>`;
}

function outraEntradaRow(t) {
  const recebido = t.status === 'recebido';
  const aluno = t.alunoId ? data.students.find(s => s.id === t.alunoId) : null;
  const quem = aluno ? (aluno.status === 'Ativo' ? aluno.nome : `${aluno.nome} (inativo)`) : (t.alunoId ? 'aluno excluído' : '');
  return `<tr>
    <td data-label="Descrição" style="text-align:left;">${escapeHtml(t.descricao || t.categoria)}${quem ? `<div style="font-size:11px;color:var(--text2);">${escapeHtml(quem)}</div>` : ''}</td>
    <td data-label="Categoria" style="text-align:left;">${escapeHtml(t.categoria)}</td>
    <td data-label="Valor">${fmtFull(t.valor)}</td>
    <td data-label="Situação"><button class="status-toggle ${recebido ? 'status-ok' : 'status-pending'}" onclick="toggleOutraEntrada('${t.id}')" title="Clique para alternar">${recebido ? '✓ Recebido' : 'A receber'}</button></td>
    <td data-label="Ações"><button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="excluirOutraEntrada('${t.id}')">Excluir</button></td>
  </tr>`;
}

async function toggleOutraEntrada(id) {
  const t = data.transactions.find(x => x.id === id);
  if (!t) return;
  await updateMensalidadeStatus(id, t.status === 'recebido' ? 'a_receber' : 'recebido');
  showToast('Situação atualizada!');
  renderInadimplenciaPage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function excluirOutraEntrada(id) {
  const t = data.transactions.find(x => x.id === id);
  if (!t) return;
  confirmAction(`Excluir o lançamento <strong>${escapeHtml(t.descricao || t.categoria)}</strong> de ${fmtFull(t.valor)}? Ele sai do Fluxo de Caixa e do Dashboard.`, async () => {
    await deleteTransaction(id);
    showToast('Lançamento excluído.');
    renderInadimplenciaPage();
    if (typeof refreshDashboard === 'function') refreshDashboard();
  });
}

async function toggleMensalidadeStatus(studentId) {
  const tx = mensalidadeTransactionFor(studentId, inadimplenciaSelectedMonth);
  if (!tx) return;
  await updateMensalidadeStatus(tx.id, tx.status === 'recebido' ? 'a_receber' : 'recebido');
  showToast('Status de pagamento atualizado!');
  renderInadimplenciaPage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function changeInadimplenciaMonth(val) {
  inadimplenciaSelectedMonth = val;
  renderInadimplenciaPage();
}

/* ---------------- Régua de cobrança: envio ---------------- */
function formatWhatsappNumber(telefone) {
  let digits = (telefone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 11) digits = '55' + digits;
  return digits;
}

function openCobrancaModal(studentId) {
  const s = data.students.find(x => x.id === studentId);
  const tx = mensalidadeTransactionFor(studentId, inadimplenciaSelectedMonth);
  const diasAtraso = tx ? Math.max(0, daysBetween(tx.data)) : 0;
  const template = pickCobrancaTemplate(diasAtraso);
  const rendered = renderCobrancaTemplate(template, s, tx);
  const templateOptions = data.cobrancaTemplates.map(t => `<option value="${t.id}" ${t.id===template.id?'selected':''}>${escapeHtml(t.nome)}</option>`).join('');
  const whatsappNum = formatWhatsappNumber(s.telefone);

  openModal(`Cobrar — ${escapeHtml(s.nome)}`, `
    <div class="form-group">
      <label>Modelo da régua de cobrança</label>
      <select id="cob-template-select" onchange="onCobrancaTemplateChange('${studentId}')">${templateOptions}</select>
    </div>
    <div class="form-group" style="margin-top:12px;">
      <label>Assunto (e-mail)</label>
      <input type="text" id="cob-assunto" value="${escapeHtml(rendered.assunto)}">
    </div>
    <div class="form-group" style="margin-top:12px;">
      <label>Mensagem</label>
      <textarea id="cob-mensagem" style="min-height:110px;">${escapeHtml(rendered.mensagem)}</textarea>
    </div>
    <div class="card" style="margin-top:16px;background:var(--surface2);">
      <div style="font-size:12px;color:var(--text2);line-height:1.8;">
        📧 E-mail: ${s.email ? escapeHtml(s.email) : '<span style="color:var(--red);">não cadastrado — edite o aluno para adicionar</span>'}<br>
        💬 WhatsApp: ${s.telefone ? escapeHtml(s.telefone) : '<span style="color:var(--red);">não cadastrado — edite o aluno para adicionar</span>'}
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" ${!s.email?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="sendCobrancaEmail('${escapeHtml(s.email||'')}')">📧 Enviar por E-mail</button>
      <button class="btn btn-success" ${!whatsappNum?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="sendCobrancaWhatsapp('${whatsappNum}')">💬 Enviar por WhatsApp</button>
      <button class="btn btn-secondary" onclick="copyCobrancaMensagem()">📋 Copiar Mensagem</button>
    </div>
  `, { width: '560px' });
}

function onCobrancaTemplateChange(studentId) {
  const s = data.students.find(x => x.id === studentId);
  const tx = mensalidadeTransactionFor(studentId, inadimplenciaSelectedMonth);
  const templateId = document.getElementById('cob-template-select').value;
  const template = data.cobrancaTemplates.find(t => t.id === templateId);
  const rendered = renderCobrancaTemplate(template, s, tx);
  document.getElementById('cob-assunto').value = rendered.assunto;
  document.getElementById('cob-mensagem').value = rendered.mensagem;
}

function sendCobrancaEmail(email) {
  const assunto = document.getElementById('cob-assunto').value;
  const mensagem = document.getElementById('cob-mensagem').value;
  window.open(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`, '_blank');
}
function sendCobrancaWhatsapp(numero) {
  const mensagem = document.getElementById('cob-mensagem').value;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
}
function copyCobrancaMensagem() {
  copyTextareaToClipboard('cob-mensagem');
}

/* ---------------- Gestão dos modelos da régua ---------------- */
function openCobrancaTemplatesManager() {
  openModal('Modelos de Cobrança (Régua)', renderCobrancaTemplatesBody(), { width: '680px' });
}
function renderCobrancaTemplatesBody() {
  const ordenados = [...data.cobrancaTemplates].sort((a,b) => a.diasRelativoVencimento - b.diasRelativoVencimento);
  return `
    <p style="font-size:12px;color:var(--text2);margin-bottom:16px;line-height:1.6;">
      Defina em quantos dias antes (negativo) ou depois (positivo) do vencimento cada mensagem deve ser sugerida. Use {nome}, {valor}, {vencimento}, {diasAtraso}, {mes} e {academia} como variáveis.
    </p>
    ${ordenados.map(t => `
      <div class="card" style="margin-bottom:12px;background:var(--surface2);">
        <div class="form-grid">
          <div class="form-group"><label>Nome do Estágio</label><input type="text" value="${escapeHtml(t.nome)}" onchange="handleUpdateCobrancaTemplate('${t.id}','nome',this.value)"></div>
          <div class="form-group"><label>Dias em relação ao vencimento</label><input type="number" value="${t.diasRelativoVencimento}" onchange="handleUpdateCobrancaTemplate('${t.id}','diasRelativoVencimento',this.value)"></div>
        </div>
        <div class="form-group" style="margin-top:10px;"><label>Assunto</label><input type="text" value="${escapeHtml(t.assunto)}" onchange="handleUpdateCobrancaTemplate('${t.id}','assunto',this.value)"></div>
        <div class="form-group" style="margin-top:10px;"><label>Mensagem</label><textarea style="min-height:70px;" onchange="handleUpdateCobrancaTemplate('${t.id}','mensagem',this.value)">${escapeHtml(t.mensagem)}</textarea></div>
        <div class="btn-row"><button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="handleDeleteCobrancaTemplate('${t.id}')">🗑️ Remover Estágio</button></div>
      </div>
    `).join('')}
    <button class="btn btn-secondary" onclick="handleAddCobrancaTemplate()">+ Adicionar Estágio</button>
  `;
}
async function handleUpdateCobrancaTemplate(id, field, value) {
  const patch = { [field]: field === 'diasRelativoVencimento' ? (parseInt(value) || 0) : value };
  await updateCobrancaTemplate(id, patch);
}
async function handleAddCobrancaTemplate() {
  await addCobrancaTemplate({ nome: 'Novo Estágio', diasRelativoVencimento: 0, assunto: 'Assunto — {academia}', mensagem: 'Oi {nome}, sua mensalidade de {valor} venceu em {vencimento}.' });
  document.querySelector('.modal-body').innerHTML = renderCobrancaTemplatesBody();
}
async function handleDeleteCobrancaTemplate(id) {
  await deleteCobrancaTemplate(id);
  document.querySelector('.modal-body').innerHTML = renderCobrancaTemplatesBody();
  showToast('Estágio removido.');
}
