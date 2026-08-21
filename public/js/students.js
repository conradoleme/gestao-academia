/* ==========================================================================
   ALUNOS — cadastro de alunos, turmas vinculadas, geração de mensalidades
   ========================================================================== */

let alunosFiltro = { nome: '', turma: '', categoria: '', status: '' };
let alunosFiltrosAbertos = false;

function alunosFiltrosAvancadosAtivos() {
  return ['nome', 'turma', 'status'].filter(k => alunosFiltro[k]).length;
}

function filteredStudents() {
  return data.students.filter(s => {
    if (alunosFiltro.nome && !s.nome.toLowerCase().includes(alunosFiltro.nome.toLowerCase())) return false;
    if (alunosFiltro.turma && s.turma !== alunosFiltro.turma) return false;
    if (alunosFiltro.categoria && s.categoria !== alunosFiltro.categoria) return false;
    if (alunosFiltro.status && s.status !== alunosFiltro.status) return false;
    return true;
  });
}

function renderAlunosPage() {
  const kids = data.students.filter(s => s.categoria === 'Kids' && s.status === 'Ativo').length;
  const adultos = data.students.filter(s => s.categoria === 'Adulto' && s.status === 'Ativo').length;
  const particulares = data.students.filter(s => s.categoria === 'Particular' && s.status === 'Ativo').length;
  const receitaPrevista = activeStudents().reduce((s, a) => s + (a.valorMensalidade || 0), 0);
  const turmaOptions = `<option value="">Turma — Todas</option>` +
    data.turmas.map(t => `<option value="${escapeHtml(t.nome)}" ${t.nome===alunosFiltro.turma?'selected':''}>${escapeHtml(t.nome)}</option>`).join('');

  document.getElementById('page-alunos').innerHTML = `
    <div class="section-header">
      <div><h1>Alunos</h1><p class="subtitle" style="margin:0;">Cadastro que alimenta automaticamente mensalidades e matrículas no fluxo de caixa</p></div>
    </div>

    <div class="card" style="margin-bottom:16px;padding:14px 16px;">
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        <div><div class="kpi-label" style="margin-bottom:2px;">Ativos</div><div style="font-size:18px;font-weight:800;">${activeStudents().length}</div></div>
        <div><div class="kpi-label" style="margin-bottom:2px;">Kids · Adulto · Particular</div><div style="font-size:18px;font-weight:800;">${kids} · ${adultos} · ${particulares}</div></div>
        <div><div class="kpi-label" style="margin-bottom:2px;">Receita Recorrente / Mês</div><div style="font-size:18px;font-weight:800;">${fmt(receitaPrevista)}</div></div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        <h3 style="margin:0;">Cadastro de Alunos</h3>
        <div class="btn-row" style="margin:0;">
          <button class="btn btn-primary" style="flex:1;" onclick="openStudentForm()">+ Novo Aluno</button>
          <button class="btn btn-secondary" onclick="gerarMensalidadesAgora()" title="Gerar mensalidades do mês">🔄</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:${alunosFiltrosAbertos ? '10px' : '16px'};">
        <select id="f-alunos-filtro-categoria" onchange="onAlunosFiltroChange()" style="flex:1;">
          <option value="">Categoria — Todas</option>
          <option value="Adulto" ${alunosFiltro.categoria==='Adulto'?'selected':''}>Adulto</option>
          <option value="Kids" ${alunosFiltro.categoria==='Kids'?'selected':''}>Kids</option>
          <option value="Particular" ${alunosFiltro.categoria==='Particular'?'selected':''}>Particular</option>
        </select>
        <button class="btn btn-secondary" onclick="toggleAlunosFiltrosAvancados()" style="white-space:nowrap;flex-shrink:0;">
          🔍 Filtros${alunosFiltrosAvancadosAtivos() ? ` (${alunosFiltrosAvancadosAtivos()})` : ''} ${alunosFiltrosAbertos ? '▲' : '▼'}
        </button>
      </div>

      ${alunosFiltrosAbertos ? `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;padding:12px;background:var(--surface2);border-radius:10px;">
          <input type="text" id="f-alunos-filtro-nome" placeholder="🔍 Buscar por nome..." value="${escapeHtml(alunosFiltro.nome)}" oninput="onAlunosFiltroChange()">
          <select id="f-alunos-filtro-turma" onchange="onAlunosFiltroChange()">${turmaOptions}</select>
          <select id="f-alunos-filtro-status" onchange="onAlunosFiltroChange()">
            <option value="">Status — Todos</option>
            <option value="Ativo" ${alunosFiltro.status==='Ativo'?'selected':''}>Ativo</option>
            <option value="Inativo" ${alunosFiltro.status==='Inativo'?'selected':''}>Inativo</option>
          </select>
          ${(alunosFiltro.nome || alunosFiltro.turma || alunosFiltro.categoria || alunosFiltro.status) ? `<button class="btn btn-secondary" onclick="handleClearAlunosFiltros()">✕ Limpar filtros</button>` : ''}
        </div>
      ` : ''}

      <div class="table-wrap table-responsive-cards">
        <table>
          <thead><tr>
            <th style="text-align:left;">Nome</th><th>Turma</th><th>Categoria</th><th>Status</th>
            <th>Mensalidade</th><th>Vencimento</th><th>Matrícula</th><th>Ações</th>
          </tr></thead>
          <tbody id="alunos-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  renderAlunosTableBody();
}

function renderAlunosTableBody() {
  const list = filteredStudents();
  document.getElementById('alunos-tbody').innerHTML = list.map(studentRow).join('') ||
    `<tr><td colspan="8" style="text-align:center;color:var(--text2);">${data.students.length ? 'Nenhum aluno encontrado com esses filtros.' : 'Nenhum aluno cadastrado.'}</td></tr>`;
}

function onAlunosFiltroChange() {
  // Nome/Turma/Status só existem no DOM quando o painel avançado está
  // aberto — preserva o valor já escolhido se o controle estiver escondido.
  const nomeEl = document.getElementById('f-alunos-filtro-nome');
  const turmaEl = document.getElementById('f-alunos-filtro-turma');
  const statusEl = document.getElementById('f-alunos-filtro-status');
  alunosFiltro = {
    nome: nomeEl ? nomeEl.value : alunosFiltro.nome,
    turma: turmaEl ? turmaEl.value : alunosFiltro.turma,
    categoria: document.getElementById('f-alunos-filtro-categoria').value,
    status: statusEl ? statusEl.value : alunosFiltro.status,
  };
  renderAlunosTableBody();
}

function toggleAlunosFiltrosAvancados() {
  alunosFiltrosAbertos = !alunosFiltrosAbertos;
  renderAlunosPage();
}

function handleClearAlunosFiltros() {
  alunosFiltro = { nome: '', turma: '', categoria: '', status: '' };
  renderAlunosPage();
}

function studentRow(s) {
  return `<tr>
    <td data-label="Nome" style="text-align:left;font-weight:600;">${escapeHtml(s.nome)}</td>
    <td data-label="Turma">${escapeHtml(s.turma || '—')}</td>
    <td data-label="Categoria"><span class="tag ${s.categoria === 'Kids' ? 'tag-yellow' : s.categoria === 'Particular' ? 'tag-cyan' : 'tag-accent'}">${s.categoria}</span></td>
    <td data-label="Status"><span class="tag ${s.status === 'Ativo' ? 'tag-green' : 'tag-red'}">${s.status}</span></td>
    <td data-label="Mensalidade">${fmtFull(s.valorMensalidade || 0)}</td>
    <td data-label="Vencimento">${s.diaVencimento ? 'Dia ' + s.diaVencimento : '—'}</td>
    <td data-label="Matrícula">${s.valorMatricula ? fmtFull(s.valorMatricula) + ' (' + (s.mesMatricula||'—') + ')' : '—'}</td>
    <td data-label="Ações">
      <button class="btn-icon" title="Editar" onclick="openStudentForm('${s.id}')">✏️</button>
      <button class="btn-icon" title="Excluir" onclick="handleDeleteStudent('${s.id}')">🗑️</button>
    </td>
  </tr>`;
}

let studentFormId = null;

function openStudentForm(id) {
  autosaveStudentDebounced.cancel?.();
  studentFormId = id || null;
  const s = id ? data.students.find(x => x.id === id) : {
    nome: '', turma: data.turmas[0]?.nome || '', categoria: 'Adulto', status: 'Ativo',
    valorMensalidade: 0, diaVencimento: 5, valorMatricula: 0, mesMatricula: MESES_PT[new Date().getMonth()],
    diaMatricula: 1, observacoes: '', email: '', telefone: '',
  };
  const turmaOptions = `<option value="" ${!s.turma?'selected':''}>— Nenhuma —</option>` +
    data.turmas.map(t => `<option value="${t.nome}" ${t.nome===s.turma?'selected':''}>${t.nome}</option>`).join('');
  const mesOptions = MESES_PT.map(m => `<option value="${m}" ${m===s.mesMatricula?'selected':''}>${m}</option>`).join('');

  openModal(id ? 'Editar Aluno' : 'Novo Aluno', `
    <div class="form-grid">
      <div class="form-group"><label>Nome</label><input type="text" id="f-nome" value="${escapeHtml(s.nome)}"></div>
      <div class="form-group"><label>Turma</label><select id="f-turma">${turmaOptions}</select></div>
      <div class="form-group"><label>Categoria</label>
        <select id="f-categoria">
          <option value="Adulto" ${s.categoria==='Adulto'?'selected':''}>Adulto</option>
          <option value="Kids" ${s.categoria==='Kids'?'selected':''}>Kids</option>
          <option value="Particular" ${s.categoria==='Particular'?'selected':''}>Particular</option>
        </select>
      </div>
      <div class="form-group"><label>Status</label>
        <select id="f-status"><option value="Ativo" ${s.status==='Ativo'?'selected':''}>Ativo</option><option value="Inativo" ${s.status==='Inativo'?'selected':''}>Inativo</option></select>
      </div>
      <div class="form-group"><label>Valor Mensalidade (R$)</label><input type="text" inputmode="decimal" id="f-mensalidade" value="${formatCurrencyValue(s.valorMensalidade||0)}"></div>
      <div class="form-group"><label>Dia Vencimento</label><input type="number" id="f-vencimento" value="${s.diaVencimento||''}" min="1" max="31"></div>
      <div class="form-group"><label>Valor Matrícula (R$)</label><input type="text" inputmode="decimal" id="f-matricula" value="${formatCurrencyValue(s.valorMatricula||0)}"></div>
      <div class="form-group"><label>Mês Matrícula</label><select id="f-mes-matricula">${mesOptions}</select></div>
      <div class="form-group"><label>Dia Matrícula</label><input type="number" id="f-dia-matricula" value="${s.diaMatricula||1}" min="1" max="31"></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="f-email" value="${escapeHtml(s.email||'')}" placeholder="aluno@email.com"></div>
      <div class="form-group"><label>WhatsApp / Telefone</label><input type="tel" id="f-telefone" value="${escapeHtml(s.telefone||'')}" placeholder="11987654321"></div>
    </div>
    <div class="form-group" style="margin-top:12px;"><label>Observações</label><textarea id="f-obs" style="min-height:60px;">${escapeHtml(s.observacoes||'')}</textarea></div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveStudentForm()">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
    <div id="student-autosave-status" style="font-size:11px;color:var(--text2);margin-top:10px;min-height:14px;"></div>
  `);
  maskCurrencyInput(document.getElementById('f-mensalidade'));
  maskCurrencyInput(document.getElementById('f-matricula'));
  attachAutosaveListeners(
    ['f-nome','f-turma','f-categoria','f-status','f-mensalidade','f-vencimento','f-matricula','f-mes-matricula','f-dia-matricula','f-email','f-telefone','f-obs'],
    autosaveStudentDebounced
  );
}

function buildStudentPatch() {
  return {
    nome: document.getElementById('f-nome').value.trim(),
    turma: document.getElementById('f-turma').value,
    categoria: document.getElementById('f-categoria').value,
    status: document.getElementById('f-status').value,
    valorMensalidade: parseCurrencyValue(document.getElementById('f-mensalidade').value),
    diaVencimento: parseInt(document.getElementById('f-vencimento').value) || null,
    valorMatricula: parseCurrencyValue(document.getElementById('f-matricula').value),
    mesMatricula: document.getElementById('f-mes-matricula').value,
    diaMatricula: parseInt(document.getElementById('f-dia-matricula').value) || 1,
    email: document.getElementById('f-email').value.trim(),
    telefone: document.getElementById('f-telefone').value.trim(),
    observacoes: document.getElementById('f-obs').value.trim(),
  };
}

// Assim que tiver um nome digitado, o registro já existe no banco — os
// campos seguintes vão só atualizando ele, sem precisar clicar em Salvar.
const autosaveStudentDebounced = debounce(async () => {
  if (!document.getElementById('f-nome')) return; // modal já foi fechado
  const patch = buildStudentPatch();
  if (!patch.nome) return;
  if (studentFormId) {
    await updateStudent(studentFormId, patch);
  } else {
    const saved = await addStudent(patch);
    studentFormId = saved.id;
  }
  showAutosaveIndicator('student-autosave-status');
});

async function saveStudentForm() {
  const patch = buildStudentPatch();
  if (!patch.nome) { showToast('Informe o nome do aluno.', 'error'); return; }
  if (studentFormId) await updateStudent(studentFormId, patch); else { const saved = await addStudent(patch); studentFormId = saved.id; }
  closeModal();
  showToast('Aluno salvo!');
  renderAlunosPage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function handleDeleteStudent(id) {
  const s = data.students.find(x => x.id === id);
  confirmAction(`Excluir o aluno <strong>${escapeHtml(s?.nome||'')}</strong>? Lançamentos já gerados não serão removidos.`, async () => {
    await deleteStudent(id);
    showToast('Aluno excluído.');
    renderAlunosPage();
    if (typeof refreshDashboard === 'function') refreshDashboard();
  });
}

async function gerarMensalidadesAgora() {
  const ym = currentYearMonth();
  const n = await ensureMensalidadesForMonth(ym);
  showToast(n > 0 ? `${n} lançamento(s) gerado(s) para ${monthLabel(ym)}.` : 'Nenhum lançamento novo — já estava atualizado.');
  if (typeof renderFinancePage === 'function') renderFinancePage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}
