/* ==========================================================================
   MURAL DE RECADOS — o instrutor publica avisos globais, pra uma turma, ou
   direto pra um aluno. Sem validade: fica visível até ser apagado. O
   aluno vê sua fatia (global + a própria turma + os endereçados a ele)
   no portal dele.
   ========================================================================== */

function alcanceLabel(r) {
  if (r.alcance === 'global') return 'Todo mundo';
  if (r.alcance === 'turma') return `Turma ${r.turma}`;
  const aluno = data.students.find(s => s.id === r.alunoId);
  return aluno ? aluno.nome : 'Aluno removido';
}

function renderMuralPage() {
  const recados = data.recados;

  document.getElementById('page-mural').innerHTML = `
    <div class="section-header">
      <div><h1>Mural de Recados</h1><p class="subtitle" style="margin:0;">Avisos pro aluno ver assim que abre o portal dele — geral, por turma, ou direto pra um aluno</p></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <button class="btn btn-primary" onclick="openRecadoForm()">+ Novo Recado</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      ${recados.length ? recados.map(recadoCard).join('') : `
        <div class="card" style="text-align:center;color:var(--text2);">Nenhum recado publicado ainda.</div>
      `}
    </div>
  `;
}

function recadoCard(r) {
  const badgeCls = r.alcance === 'global' ? 'tag-accent' : r.alcance === 'turma' ? 'tag-cyan' : 'tag-yellow';
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <strong style="font-size:15px;">${escapeHtml(r.titulo)}</strong>
            <span class="tag ${badgeCls}">${escapeHtml(alcanceLabel(r))}</span>
          </div>
          <p style="margin:0;color:var(--text2);white-space:pre-wrap;">${escapeHtml(r.mensagem)}</p>
          <div style="font-size:11px;color:var(--text2);margin-top:8px;">${new Date(r.createdAt).toLocaleDateString('pt-BR')}</div>
        </div>
        <button class="btn-icon" title="Apagar" onclick="handleDeleteRecado('${r.id}')">🗑️</button>
      </div>
    </div>
  `;
}

function openRecadoForm() {
  openModal('Novo Recado', `
    <div class="form-group"><label>Título</label><input type="text" id="rec-titulo" placeholder="Ex: Aula de sábado cancelada"></div>
    <div class="form-group" style="margin-top:12px;"><label>Mensagem</label><textarea id="rec-mensagem" style="min-height:100px;"></textarea></div>
    <div class="form-group" style="margin-top:12px;">
      <label>Quem vê</label>
      <select id="rec-alcance" onchange="onRecadoAlcanceChange()">
        <option value="global">Todo mundo</option>
        <option value="turma">Uma turma</option>
        <option value="aluno">Um aluno específico</option>
      </select>
    </div>
    <div class="form-group" id="rec-turma-group" style="margin-top:12px;display:none;">
      <label>Turma</label>
      <select id="rec-turma">${data.turmas.map(t => `<option value="${escapeHtml(t.nome)}">${escapeHtml(t.nome)}</option>`).join('')}</select>
    </div>
    <div class="form-group" id="rec-aluno-group" style="margin-top:12px;display:none;">
      <label>Aluno</label>
      <select id="rec-aluno-id">${alunoSelectOptions()}</select>
    </div>
    <div id="rec-error"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" onclick="saveRecadoForm()">Publicar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `, { width: '460px' });
}

function onRecadoAlcanceChange() {
  const alcance = document.getElementById('rec-alcance').value;
  document.getElementById('rec-turma-group').style.display = alcance === 'turma' ? 'block' : 'none';
  document.getElementById('rec-aluno-group').style.display = alcance === 'aluno' ? 'block' : 'none';
}

async function saveRecadoForm() {
  const titulo = document.getElementById('rec-titulo').value.trim();
  const mensagem = document.getElementById('rec-mensagem').value.trim();
  const alcance = document.getElementById('rec-alcance').value;
  const errorEl = document.getElementById('rec-error');
  errorEl.innerHTML = '';

  if (!titulo || !mensagem) { errorEl.innerHTML = `<div class="alert alert-danger">Preencha o título e a mensagem.</div>`; return; }
  if (alcance === 'turma' && !data.turmas.length) { errorEl.innerHTML = `<div class="alert alert-danger">Cadastre uma turma primeiro.</div>`; return; }
  if (alcance === 'aluno' && !data.students.length) { errorEl.innerHTML = `<div class="alert alert-danger">Cadastre um aluno primeiro.</div>`; return; }

  const payload = { titulo, mensagem, alcance };
  if (alcance === 'turma') payload.turma = document.getElementById('rec-turma').value;
  if (alcance === 'aluno') payload.alunoId = document.getElementById('rec-aluno-id').value;

  try {
    await addRecado(payload);
    closeModal();
    showToast('Recado publicado!');
    renderMuralPage();
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

function handleDeleteRecado(id) {
  confirmAction('Apagar esse recado? Ele some do mural e do portal dos alunos.', async () => {
    await removeRecado(id);
    showToast('Recado apagado.');
    renderMuralPage();
  });
}
