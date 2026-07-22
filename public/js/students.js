/* ==========================================================================
   ALUNOS — cadastro de alunos, turmas vinculadas, geração de mensalidades
   ========================================================================== */

function renderAlunosPage() {
  const kids = data.students.filter(s => s.categoria === 'Kids' && s.status === 'Ativo').length;
  const adultos = data.students.filter(s => s.categoria === 'Adulto' && s.status === 'Ativo').length;
  const particulares = data.students.filter(s => s.categoria === 'Particular' && s.status === 'Ativo').length;
  const receitaPrevista = activeStudents().reduce((s, a) => s + (a.valorMensalidade || 0), 0);

  document.getElementById('page-alunos').innerHTML = `
    <div class="section-header">
      <div><h1>Alunos</h1><p class="subtitle" style="margin:0;">Cadastro que alimenta automaticamente mensalidades e matrículas no fluxo de caixa</p></div>
    </div>

    <div class="card-grid card-grid-3" style="margin-bottom:24px;">
      <div class="kpi kpi-accent"><div class="kpi-label">Alunos Ativos</div><div class="kpi-value">${activeStudents().length}</div></div>
      <div class="kpi kpi-green">
        <div class="kpi-label">Por Categoria</div>
        <div class="kpi-value" style="font-size:18px;">Kids ${kids} · Adulto ${adultos} · Particular ${particulares}</div>
      </div>
      <div class="kpi kpi-green"><div class="kpi-label">Receita Recorrente Prevista</div><div class="kpi-value">${fmt(receitaPrevista)}</div><div class="kpi-sub">/mês</div></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;">Cadastro de Alunos</h3>
        <div class="btn-row" style="margin:0;">
          <button class="btn btn-secondary" onclick="gerarMensalidadesAgora()">🔄 Gerar mensalidades do mês</button>
          <button class="btn btn-primary" onclick="openStudentForm()">+ Novo Aluno</button>
        </div>
      </div>
      <div class="table-wrap table-responsive-cards">
        <table>
          <thead><tr>
            <th style="text-align:left;">Nome</th><th>Turma</th><th>Categoria</th><th>Status</th>
            <th>Mensalidade</th><th>Vencimento</th><th>Matrícula</th><th>Ações</th>
          </tr></thead>
          <tbody>${data.students.map(studentRow).join('') || `<tr><td colspan="8" style="text-align:center;color:var(--text2);">Nenhum aluno cadastrado.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
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

function openStudentForm(id) {
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
      <div class="form-group"><label>Valor Mensalidade (R$)</label><input type="number" id="f-mensalidade" value="${s.valorMensalidade||0}" step="0.01"></div>
      <div class="form-group"><label>Dia Vencimento</label><input type="number" id="f-vencimento" value="${s.diaVencimento||''}" min="1" max="31"></div>
      <div class="form-group"><label>Valor Matrícula (R$)</label><input type="number" id="f-matricula" value="${s.valorMatricula||0}" step="0.01"></div>
      <div class="form-group"><label>Mês Matrícula</label><select id="f-mes-matricula">${mesOptions}</select></div>
      <div class="form-group"><label>Dia Matrícula</label><input type="number" id="f-dia-matricula" value="${s.diaMatricula||1}" min="1" max="31"></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="f-email" value="${escapeHtml(s.email||'')}" placeholder="aluno@email.com"></div>
      <div class="form-group"><label>WhatsApp / Telefone</label><input type="tel" id="f-telefone" value="${escapeHtml(s.telefone||'')}" placeholder="11987654321"></div>
    </div>
    <div class="form-group" style="margin-top:12px;"><label>Observações</label><textarea id="f-obs" style="min-height:60px;">${escapeHtml(s.observacoes||'')}</textarea></div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveStudentForm(${id ? `'${id}'` : null})">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `);
}

async function saveStudentForm(id) {
  const patch = {
    nome: document.getElementById('f-nome').value.trim(),
    turma: document.getElementById('f-turma').value,
    categoria: document.getElementById('f-categoria').value,
    status: document.getElementById('f-status').value,
    valorMensalidade: parseFloat(document.getElementById('f-mensalidade').value) || 0,
    diaVencimento: parseInt(document.getElementById('f-vencimento').value) || null,
    valorMatricula: parseFloat(document.getElementById('f-matricula').value) || 0,
    mesMatricula: document.getElementById('f-mes-matricula').value,
    diaMatricula: parseInt(document.getElementById('f-dia-matricula').value) || 1,
    email: document.getElementById('f-email').value.trim(),
    telefone: document.getElementById('f-telefone').value.trim(),
    observacoes: document.getElementById('f-obs').value.trim(),
  };
  if (!patch.nome) { showToast('Informe o nome do aluno.', 'error'); return; }
  if (id) await updateStudent(id, patch); else await addStudent(patch);
  closeModal();
  showToast(id ? 'Aluno atualizado!' : 'Aluno cadastrado!');
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
