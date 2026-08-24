/* ==========================================================================
   GRADUAÇÃO — progresso de cada aluno rumo à próxima faixa, a partir da
   presença real e da regra configurada pra academia. Nunca promove
   sozinho: só calcula e mostra "atingiu o critério" — quem graduar de
   fato é sempre uma ação manual do instrutor.
   ========================================================================== */

let graduacaoFiltroCategoria = '';

function graduacaoProgressoPct(status) {
  if (!status || status.semRegra || status.semDataInicio) return status && status.pronto ? 1 : 0;
  const partes = [
    Math.min(1, status.meses / (status.minMeses || 1)),
    Math.min(1, status.totalAulas / (status.minAulas || 1)),
    Math.min(1, status.frequenciaSemanal / (status.minFrequenciaSemanal || 1)),
  ];
  return partes.reduce((a, b) => a + b, 0) / partes.length;
}

function renderGraduacaoPage() {
  const alunos = activeStudents()
    .filter(s => !graduacaoFiltroCategoria || s.categoria === graduacaoFiltroCategoria)
    .map(s => ({ student: s, status: computeGraduacaoStatus(s) }))
    .sort((a, b) => {
      const proA = a.status?.pronto ? 1 : 0, proB = b.status?.pronto ? 1 : 0;
      if (proA !== proB) return proB - proA;
      return graduacaoProgressoPct(b.status) - graduacaoProgressoPct(a.status);
    });

  const prontos = alunos.filter(a => a.status?.pronto).length;

  document.getElementById('page-graduacao').innerHTML = `
    <div class="section-header">
      <div><h1>Graduação</h1><p class="subtitle" style="margin:0;">Progresso de cada aluno rumo à próxima faixa, a partir da presença real</p></div>
    </div>

    <div class="card-grid card-grid-2" style="margin-bottom:20px;">
      <div class="kpi kpi-green"><div class="kpi-label">Prontos para Graduar</div><div class="kpi-value">${prontos}</div></div>
      <div class="kpi kpi-accent"><div class="kpi-label">Alunos Acompanhados</div><div class="kpi-value">${alunos.length}</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div class="form-group" style="max-width:220px;margin-bottom:0;">
          <label>Categoria</label>
          <select id="f-graduacao-categoria" onchange="onGraduacaoFiltroChange()">
            <option value="">Todas</option>
            <option value="Adulto" ${graduacaoFiltroCategoria==='Adulto'?'selected':''}>Adulto</option>
            <option value="Kids" ${graduacaoFiltroCategoria==='Kids'?'selected':''}>Kids</option>
            <option value="Particular" ${graduacaoFiltroCategoria==='Particular'?'selected':''}>Particular</option>
          </select>
        </div>
        <button class="btn btn-secondary" onclick="showPage('configuracoes')">⚙️ Configurar Regras de Graduação</button>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap table-responsive-cards">
        <table>
          <thead><tr>
            <th style="text-align:left;">Aluno</th><th style="text-align:left;">Faixa Atual</th><th>Tempo</th><th>Aulas</th><th>Frequência</th><th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody>${alunos.map(graduacaoRow).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text2);">Nenhum aluno ativo nessa categoria.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

function graduacaoRow({ student, status }) {
  if (!status) {
    return `<tr>
      <td data-label="Aluno" style="text-align:left;font-weight:600;">${escapeHtml(student.nome)}</td>
      <td data-label="Faixa Atual" colspan="5" style="text-align:left;color:var(--text2);">Nenhuma regra de graduação configurada pra categoria ${escapeHtml(student.categoria)}.</td>
      <td data-label="Ações"><button class="btn-icon" title="Ver histórico" onclick="openHistoricoGraduacao('${student.id}')">📜</button></td>
    </tr>`;
  }

  // Cor da faixa vai no fundo/borda, nunca no texto — faixas claras (ex:
  // Branca) ficam ilegíveis se o texto usar a cor da própria faixa.
  const faixaTag = `<span class="tag" style="background:${status.cor}22;color:var(--text);border:1px solid ${status.cor}88;">${escapeHtml(status.faixaAtual)}${student.grau ? ' · ' + student.grau + '°' : ''}</span>`;

  if (status.semRegra) {
    return `<tr>
      <td data-label="Aluno" style="text-align:left;font-weight:600;">${escapeHtml(student.nome)}</td>
      <td data-label="Faixa Atual" style="text-align:left;">${faixaTag}</td>
      <td data-label="Tempo" colspan="3" style="color:var(--text2);">Faixa máxima configurada</td>
      <td data-label="Status">—</td>
      <td data-label="Ações"><button class="btn-icon" title="Ver histórico" onclick="openHistoricoGraduacao('${student.id}')">📜</button></td>
    </tr>`;
  }

  if (status.semDataInicio) {
    return `<tr>
      <td data-label="Aluno" style="text-align:left;font-weight:600;">${escapeHtml(student.nome)}</td>
      <td data-label="Faixa Atual" style="text-align:left;">${faixaTag}</td>
      <td data-label="Tempo" colspan="3" style="color:var(--text2);">Defina a Data de Início na ficha do aluno</td>
      <td data-label="Status"><span class="tag" style="background:var(--surface2);">Sem dados</span></td>
      <td data-label="Ações"><button class="btn-icon" title="Editar aluno" onclick="showPage('alunos').then(()=>openStudentForm('${student.id}'))">✏️</button></td>
    </tr>`;
  }

  const statusTag = status.pronto
    ? `<span class="status-toggle status-ok">✓ Pronto</span>`
    : `<span class="status-toggle status-pending">Em progresso</span>`;

  return `<tr>
    <td data-label="Aluno" style="text-align:left;font-weight:600;">${escapeHtml(student.nome)}</td>
    <td data-label="Faixa Atual" style="text-align:left;">${faixaTag}</td>
    <td data-label="Tempo" class="${status.okMeses?'pos':''}">${status.meses}/${status.minMeses}m</td>
    <td data-label="Aulas" class="${status.okAulas?'pos':''}">${status.totalAulas}/${status.minAulas}</td>
    <td data-label="Frequência" class="${status.okFrequencia?'pos':''}">${status.frequenciaSemanal.toFixed(1)}/${status.minFrequenciaSemanal}x sem.</td>
    <td data-label="Status">${statusTag}</td>
    <td data-label="Ações" style="display:flex;gap:4px;flex-wrap:wrap;">
      ${status.pronto ? `<button class="btn btn-primary" style="padding:6px 10px;font-size:12px;" onclick="openGraduarModal('${student.id}')">🎓 Graduar</button>` : ''}
      <button class="btn-icon" title="Ver histórico" onclick="openHistoricoGraduacao('${student.id}')">📜</button>
    </td>
  </tr>`;
}

function onGraduacaoFiltroChange() {
  graduacaoFiltroCategoria = document.getElementById('f-graduacao-categoria').value;
  renderGraduacaoPage();
}

function openGraduarModal(alunoId) {
  const aluno = data.students.find(s => s.id === alunoId);
  const status = computeGraduacaoStatus(aluno);
  if (!status || !status.proximaFaixa) return;

  openModal(`Graduar — ${escapeHtml(aluno.nome)}`, `
    <p style="color:var(--text2);font-size:13px;margin-bottom:14px;">
      ${escapeHtml(aluno.nome)} atingiu o critério configurado pra sair de <strong>${escapeHtml(status.faixaAtual)}</strong> pra <strong>${escapeHtml(status.proximaFaixa)}</strong>.
      Confirme abaixo pra registrar a graduação — essa ação atualiza a faixa atual do aluno.
    </p>
    <div class="form-grid">
      <div class="form-group"><label>Data</label><input type="date" id="f-grad-data" value="${todayStr()}"></div>
      <div class="form-group"><label>Nova Faixa</label><input type="text" id="f-grad-faixa" value="${escapeHtml(status.proximaFaixa)}" disabled></div>
      <div class="form-group"><label>Grau (pontas)</label><input type="number" id="f-grad-grau" value="0" min="0" max="10"></div>
    </div>
    <div class="form-group" style="margin-top:12px;"><label>Observações</label><textarea id="f-grad-obs" style="min-height:60px;" placeholder="Opcional"></textarea></div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="handleConfirmarGraduacao('${alunoId}', '${escapeHtml(status.faixaAtual)}', '${escapeHtml(status.proximaFaixa)}')">Confirmar Graduação</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '480px' });
}

async function handleConfirmarGraduacao(alunoId, faixaAnterior, faixaNova) {
  const payload = {
    alunoId,
    data: document.getElementById('f-grad-data').value || todayStr(),
    faixaAnterior,
    faixaNova,
    grau: parseInt(document.getElementById('f-grad-grau').value) || 0,
    observacoes: document.getElementById('f-grad-obs').value.trim(),
  };
  await addGraduacao(payload);
  closeModal();
  showToast(`🎓 Graduado(a) para ${faixaNova}!`);
  renderGraduacaoPage();
}

function openHistoricoGraduacao(alunoId) {
  const aluno = data.students.find(s => s.id === alunoId);
  const historico = graduacoesDoAluno(alunoId);

  openModal(`Histórico — ${escapeHtml(aluno.nome)}`, `
    ${historico.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th style="text-align:left;">Data</th><th style="text-align:left;">De</th><th style="text-align:left;">Para</th><th>Grau</th><th>Ações</th></tr></thead>
          <tbody>${historico.map(g => `
            <tr>
              <td style="text-align:left;">${fmtDate(g.data)}</td>
              <td style="text-align:left;">${escapeHtml(g.faixaAnterior || '—')}</td>
              <td style="text-align:left;">${escapeHtml(g.faixaNova)}</td>
              <td>${g.grau}°</td>
              <td><button class="btn-icon" title="Desfazer" onclick="handleDesfazerGraduacao('${g.id}')">🗑️</button></td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : `<p style="color:var(--text2);">Nenhuma graduação registrada ainda.</p>`}
    <div class="btn-row" style="margin-top:16px;"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
  `, { width: '520px' });
}

function handleDesfazerGraduacao(id) {
  confirmAction('Desfazer essa graduação? O aluno volta pra faixa anterior registrada nesse evento.', async () => {
    await removeGraduacao(id);
    showToast('Graduação desfeita.');
    closeModal();
    renderGraduacaoPage();
  });
}
