/* ==========================================================================
   CHAMADA — presença por turma, com opção de marcar qualquer aluno fora
   da turma selecionada (reposição, drop-in, troca de horário).
   ========================================================================== */

let chamadaData = todayStr();
let chamadaTurma = '';
let chamadaBusca = '';

function renderChamadaPage() {
  const turmaOptions = `<option value="">— Resumo do Dia —</option>` +
    data.turmas.map(t => `<option value="${escapeHtml(t.nome)}" ${t.nome === chamadaTurma ? 'selected' : ''}>${escapeHtml(t.nome)}</option>`).join('');

  document.getElementById('page-chamada').innerHTML = `
    <div class="section-header">
      <div><h1>Chamada</h1><p class="subtitle" style="margin:0;">Registre a presença dos alunos — a base pra graduação e pro acompanhamento de evolução</p></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="form-grid">
        <div class="form-group" style="margin-bottom:0;">
          <label>Data</label>
          <input type="date" id="f-chamada-data" value="${chamadaData}" onchange="onChamadaFiltroChange()">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Turma</label>
          <select id="f-chamada-turma" onchange="onChamadaFiltroChange()">${turmaOptions}</select>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <h3>Adicionar aluno fora dessa turma</h3>
      <input type="text" id="f-chamada-busca" placeholder="🔍 Buscar aluno por nome..." value="${escapeHtml(chamadaBusca)}" oninput="onChamadaBuscaChange()">
      <div id="chamada-busca-resultados" style="margin-top:10px;"></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;">${chamadaTurma ? escapeHtml(chamadaTurma) : 'Resumo do Dia'} — ${fmtDate(chamadaData)}</h3>
        <span id="chamada-contador" style="font-size:13px;color:var(--text2);"></span>
      </div>
      <div id="chamada-lista"></div>
    </div>
  `;
  renderChamadaLista();
  renderChamadaBuscaResultados();
}

function chamadaRoster() {
  if (chamadaTurma) {
    return activeStudents().filter(s => s.turma === chamadaTurma);
  }
  // Sem turma selecionada: mostra quem já foi marcado presente na data, mais fácil de conferir a chamada do dia.
  const presentesHoje = new Set(data.presencas.filter(p => p.data === chamadaData).map(p => p.alunoId));
  return activeStudents().filter(s => presentesHoje.has(s.id));
}

function renderChamadaLista() {
  const roster = chamadaRoster().sort((a, b) => a.nome.localeCompare(b.nome));
  const presentes = roster.filter(s => presencaExistente(s.id, chamadaData, chamadaTurma || null));
  document.getElementById('chamada-contador').textContent = `${presentes.length}/${roster.length} presentes`;

  document.getElementById('chamada-lista').innerHTML = roster.length ? `
    <div class="table-wrap table-responsive-cards">
      <table>
        <thead><tr><th style="text-align:left;">Aluno</th><th style="text-align:left;">Turma</th><th>Presença</th></tr></thead>
        <tbody>${roster.map(chamadaRow).join('')}</tbody>
      </table>
    </div>
  ` : `<p style="color:var(--text2);text-align:center;padding:20px 0;">${chamadaTurma ? 'Nenhum aluno ativo cadastrado nessa turma.' : 'Ninguém marcado presente ainda nessa data — use a turma acima ou a busca pra adicionar.'}</p>`;
}

function chamadaRow(s) {
  const presenca = presencaExistente(s.id, chamadaData, chamadaTurma || null);
  const marcado = !!presenca;
  return `<tr>
    <td data-label="Aluno" style="text-align:left;font-weight:600;">${escapeHtml(s.nome)}</td>
    <td data-label="Turma" style="text-align:left;color:var(--text2);">${escapeHtml(s.turma || '—')}</td>
    <td data-label="Presença">
      <button class="status-toggle ${marcado ? 'status-ok' : 'status-pending'}" onclick="handleToggleChamada('${s.id}', '${presenca ? presenca.id : ''}')">
        ${marcado ? '✓ Presente' : 'Marcar'}
      </button>
    </td>
  </tr>`;
}

async function handleToggleChamada(alunoId, presencaId) {
  if (presencaId) {
    await removePresenca(presencaId);
  } else {
    await addPresenca(alunoId, chamadaData, chamadaTurma || null);
  }
  renderChamadaLista();
}

function onChamadaFiltroChange() {
  chamadaData = document.getElementById('f-chamada-data').value;
  chamadaTurma = document.getElementById('f-chamada-turma').value;
  renderChamadaPage();
}

function onChamadaBuscaChange() {
  chamadaBusca = document.getElementById('f-chamada-busca').value;
  renderChamadaBuscaResultados();
}

function renderChamadaBuscaResultados() {
  const container = document.getElementById('chamada-busca-resultados');
  if (!container) return;
  if (!chamadaBusca.trim()) { container.innerHTML = ''; return; }

  const termo = chamadaBusca.toLowerCase();
  const resultados = activeStudents()
    .filter(s => s.nome.toLowerCase().includes(termo))
    .filter(s => !chamadaTurma || s.turma !== chamadaTurma) // já aparece na lista principal
    .slice(0, 8);

  container.innerHTML = resultados.length ? resultados.map(s => {
    const jaMarcado = !!presencaExistente(s.id, chamadaData, chamadaTurma || null);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
      <div><strong>${escapeHtml(s.nome)}</strong> <span style="color:var(--text2);font-size:12.5px;">${escapeHtml(s.turma || 'sem turma')}</span></div>
      <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" ${jaMarcado ? 'disabled' : ''} onclick="handleAdicionarChamada('${s.id}')">${jaMarcado ? '✓ Já presente' : '+ Marcar presente'}</button>
    </div>`;
  }).join('') : `<p style="color:var(--text2);font-size:13px;margin:8px 0 0;">Nenhum aluno encontrado.</p>`;
}

async function handleAdicionarChamada(alunoId) {
  await addPresenca(alunoId, chamadaData, chamadaTurma || null);
  showToast('Presença registrada!');
  renderChamadaLista();
  renderChamadaBuscaResultados();
}
