/* ==========================================================================
   TURMAS — cadastro de turmas, grade horária e planejamento de ocupação do tatame
   ========================================================================== */

function renderTurmasPage() {
  const diag = computePlanejamentoDiagnostico();
  const tatame = computeTatameCapacity();

  document.getElementById('page-turmas').innerHTML = `
    <div class="section-header">
      <div><h1>Turmas &amp; Tatame</h1><p class="subtitle" style="margin:0;">Grade horária, cadastro de turmas e planejamento de ocupação do tatame</p></div>
    </div>

    <div class="alert alert-${diag.alerta.nivel === 'critico' ? 'danger' : diag.alerta.nivel === 'atencao' ? 'warning' : 'success'}">
      ${diag.alerta.nivel === 'critico' ? '🔴' : diag.alerta.nivel === 'atencao' ? '🟡' : '🟢'} ${diag.alerta.texto}
    </div>

    <div class="card" style="margin-bottom:24px;">
      <h3>Capacidade Atual do Tatame</h3>
      <div class="card-grid card-grid-4" style="margin-bottom:16px;">
        <div class="kpi kpi-accent"><div class="kpi-label">Área do Tatame</div><div class="kpi-value">${tatame.area.toFixed(2)} m²</div><div class="kpi-sub">${data.meta.tatame.comprimento}m × ${data.meta.tatame.largura}m</div></div>
        <div class="kpi kpi-green"><div class="kpi-label">Confortável</div><div class="kpi-value">${Math.floor(tatame.niveis[0].alunosEquivalentes)} alunos</div><div class="kpi-sub">ideal p/ treino técnico</div></div>
        <div class="kpi kpi-accent"><div class="kpi-label">Operacional</div><div class="kpi-value">${Math.floor(tatame.niveis[1].alunosEquivalentes)} alunos</div><div class="kpi-sub">padrão do dia a dia</div></div>
        <div class="kpi kpi-yellow"><div class="kpi-label">Segurança (máximo)</div><div class="kpi-value">${Math.floor(tatame.capacidadeSeguranca)} alunos</div><div class="kpi-sub">limite mínimo aceitável</div></div>
      </div>
      <div class="alert" style="margin-bottom:0;background:${diag.faixaAtual.cor}1a;border:1px solid ${diag.faixaAtual.cor}55;color:${diag.faixaAtual.cor};">
        Você está atualmente na faixa <strong>${diag.faixaAtual.label.toUpperCase()}</strong>
        — turma mais cheia: <strong>${diag.turmaMaisCheia?.nome || '—'}</strong> com ${(diag.turmaMaisCheia?.freqAtual || 0)} aluno(s) por sessão (${((diag.turmaMaisCheia?.pctCapacidade||0)*100).toFixed(0)}% da capacidade de segurança).
      </div>
    </div>

    <div class="card-grid card-grid-2" style="margin-bottom:24px;">
      <div class="card">
        <h3>1) Espaço Físico do Tatame</h3>
        <div class="form-grid">
          <div class="form-group"><label>Comprimento (m)</label><input type="number" id="tatame-comp" value="${data.meta.tatame.comprimento}" step="0.1" onchange="updateTatameDim()"></div>
          <div class="form-group"><label>Largura (m)</label><input type="number" id="tatame-larg" value="${data.meta.tatame.largura}" step="0.1" onchange="updateTatameDim()"></div>
        </div>
        <div style="margin-top:12px;font-size:13px;color:var(--text2);">Área total: <strong style="color:var(--text);">${tatame.area.toFixed(2)} m²</strong></div>
        <div class="form-group" style="margin-top:12px;"><label>Concentração no horário de pico (% dos matriculados no horário mais cheio)</label>
          <input type="number" id="tatame-pico" value="${(data.meta.concentracaoPico*100).toFixed(0)}" min="1" max="100" onchange="updateConcentracaoPico()">
        </div>
      </div>
      <div class="card">
        <h3>2) Padrões de Densidade do Tatame</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th style="text-align:left;">Nível</th><th>m²/dupla</th><th>Duplas</th><th>Alunos equiv.</th></tr></thead>
            <tbody>${tatame.niveis.map(n => `<tr>
              <td style="text-align:left;">${n.id} <span style="color:var(--text2);font-size:11px;">— ${n.descricao}</span></td>
              <td>${n.m2PorDupla}</td>
              <td>${n.duplas !== null ? n.duplas.toFixed(2) : '—'}</td>
              <td style="font-weight:700;">${n.alunosEquivalentes.toFixed(2)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="kpi-sub" style="margin-top:10px;">Capacidade de Segurança (N3): <strong style="color:var(--text);">${tatame.capacidadeSeguranca.toFixed(2)} alunos por sessão</strong></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;">3) Frequência por Turma vs. Capacidade do Tatame</h3>
        <button class="btn btn-primary" onclick="openTurmaForm()">+ Nova Turma</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th style="text-align:left;">Turma</th><th>Horários</th><th>Alunos</th><th>Freq. Anterior</th><th>Freq. Atual</th>
            <th>Crescimento</th><th>% Capacidade Segurança</th><th>Faixa</th><th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody>${diag.ocupacao.map(turmaRow).join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="card-grid card-grid-2">
      <div class="card">
        <h3>4) Diagnóstico de Crescimento</h3>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;"><span style="color:var(--text2);">Crescimento total da escola</span><span class="${diag.crescimentoTotal>=0?'pos':'neg'}">${fmtPct(diag.crescimentoTotal*100)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:var(--text2);">Alunos ativos cadastrados</span><span>${diag.alunosAtivos}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:var(--text2);">Alunos matriculados no ponto de estouro</span><span>${isFinite(diag.estouroEm) ? diag.estouroEm.toFixed(0) : '—'}</span></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:var(--text2);">Turma mais cheia</span><span style="font-weight:700;">${diag.turmaMaisCheia?.nome || '—'} (${((diag.turmaMaisCheia?.pctCapacidade||0)*100).toFixed(0)}%)</span></div>
        </div>
      </div>
      <div class="card">
        <h3>Grade Horária Semanal</h3>
        ${renderGradeHoraria()}
      </div>
    </div>
  `;
}

function turmaRow(t) {
  const badgeCls = t.nivel === 'critico' ? 'tag-red' : t.nivel === 'atencao' ? 'tag-yellow' : 'tag-green';
  return `<tr>
    <td style="text-align:left;font-weight:600;">${t.nome}</td>
    <td style="font-size:11px;color:var(--text2);">${t.horarios.map(h=>`${h.dia.slice(0,3)} ${h.hora}`).join(', ') || '—'}</td>
    <td>${t.alunosMatriculados}</td>
    <td><input type="number" value="${t.freqAnterior}" class="mini-input" onchange="updateTurmaFreq('${t.id}','freqAnterior',this.value)"></td>
    <td><input type="number" value="${t.freqAtual}" class="mini-input" onchange="updateTurmaFreq('${t.id}','freqAtual',this.value)"></td>
    <td class="${t.crescimento>=0?'pos':'neg'}">${fmtPct(t.crescimento*100)}</td>
    <td style="font-weight:700;">${(t.pctCapacidade*100).toFixed(0)}%</td>
    <td><span class="tag" style="background:${t.faixa.cor}1a;color:${t.faixa.cor};">${t.faixa.label}</span></td>
    <td><span class="tag ${badgeCls}">${t.label}</span></td>
    <td>
      <button class="btn-icon" title="Editar" onclick="openTurmaForm('${t.id}')">✏️</button>
      <button class="btn-icon" title="Excluir" onclick="handleDeleteTurma('${t.id}')">🗑️</button>
    </td>
  </tr>`;
}

function renderGradeHoraria() {
  const horarios = [...new Set(data.turmas.flatMap(t => t.horarios.map(h => h.hora)))].sort();
  const dias = DIAS_SEMANA.slice(0, 6);
  return `<div class="table-wrap"><table>
    <thead><tr><th style="text-align:left;">Horário</th>${dias.map(d=>`<th>${d.slice(0,3)}</th>`).join('')}</tr></thead>
    <tbody>${horarios.map(hora => `<tr>
      <td style="text-align:left;font-weight:600;">${hora}</td>
      ${dias.map(dia => {
        const t = data.turmas.find(t => t.horarios.some(h => h.dia === dia && h.hora === hora));
        return `<td>${t ? `<span class="tag tag-accent">${t.nome}</span>` : '—'}</td>`;
      }).join('')}
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function updateTatameDim() {
  data.meta.tatame.comprimento = parseFloat(document.getElementById('tatame-comp').value) || 1;
  data.meta.tatame.largura = parseFloat(document.getElementById('tatame-larg').value) || 1;
  await persistAcademiaSettings();
  renderTurmasPage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}
async function updateConcentracaoPico() {
  data.meta.concentracaoPico = clamp(parseFloat(document.getElementById('tatame-pico').value) || 10, 1, 100) / 100;
  await persistAcademiaSettings();
  renderTurmasPage();
}
async function updateTurmaFreq(id, field, val) {
  await updateTurma(id, { [field]: parseFloat(val) || 0 });
  renderTurmasPage();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

let tempTurmaHorarios = [];

function openTurmaForm(id) {
  const t = id ? data.turmas.find(x => x.id === id) : { nome: '', horarios: [], freqAnterior: 0, freqAtual: 0 };
  tempTurmaHorarios = (t.horarios || []).map(h => ({ ...h }));

  openModal(id ? 'Editar Turma' : 'Nova Turma', `
    <div class="form-grid">
      <div class="form-group"><label>Nome da Turma</label><input type="text" id="f-turma-nome" value="${escapeHtml(t.nome)}" placeholder="Ex: T1900"></div>
      <div class="form-group"><label>Frequência Atual (média)</label><input type="number" id="f-turma-freq" value="${t.freqAtual}"></div>
    </div>
    <div style="margin-top:16px;">
      <label style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);font-weight:600;">Horários da Turma</label>
      <div id="turma-horarios-rows" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;"></div>
      <button class="btn btn-secondary" style="margin-top:10px;" onclick="addHorarioRow()">+ Adicionar Horário</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveTurmaForm(${id ? `'${id}'` : null})">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `);
  renderHorarioRows();
}

function renderHorarioRows() {
  const container = document.getElementById('turma-horarios-rows');
  if (!container) return;
  container.innerHTML = tempTurmaHorarios.length ? tempTurmaHorarios.map((h, i) => `
    <div style="display:flex;gap:8px;align-items:center;">
      <select style="flex:1;" onchange="updateHorarioField(${i},'dia',this.value)">
        ${DIAS_SEMANA.slice(0,6).map(d => `<option value="${d}" ${d===h.dia?'selected':''}>${d}</option>`).join('')}
      </select>
      <input type="time" value="${h.hora||''}" style="flex:1;" onchange="updateHorarioField(${i},'hora',this.value)">
      <button class="btn-icon" title="Remover horário" onclick="removeHorarioRow(${i})">🗑️</button>
    </div>`).join('') : `<div style="color:var(--text2);font-size:12px;">Nenhum horário cadastrado ainda.</div>`;
}

function addHorarioRow() {
  tempTurmaHorarios.push({ dia: 'Segunda', hora: '19:00' });
  renderHorarioRows();
}
function removeHorarioRow(i) {
  tempTurmaHorarios.splice(i, 1);
  renderHorarioRows();
}
function updateHorarioField(i, field, val) {
  tempTurmaHorarios[i][field] = val;
}

async function saveTurmaForm(id) {
  const nome = document.getElementById('f-turma-nome').value.trim();
  if (!nome) { showToast('Informe o nome da turma.', 'error'); return; }
  const freqAtual = parseFloat(document.getElementById('f-turma-freq').value) || 0;
  const horarios = tempTurmaHorarios.filter(h => h.dia && h.hora);

  if (id) {
    const t = data.turmas.find(x => x.id === id);
    await updateTurma(id, { nome, freqAnterior: t.freqAtual, freqAtual, horarios });
  } else {
    await addTurma({ nome, freqAnterior: freqAtual, freqAtual, horarios });
  }
  closeModal();
  showToast('Turma salva!');
  renderTurmasPage();
}

function handleDeleteTurma(id) {
  const t = data.turmas.find(x => x.id === id);
  confirmAction(`Excluir a turma <strong>${escapeHtml(t?.nome||'')}</strong>?`, async () => {
    await deleteTurma(id);
    showToast('Turma excluída.');
    renderTurmasPage();
  });
}
