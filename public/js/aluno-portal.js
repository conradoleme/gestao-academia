/* ==========================================================================
   PORTAL DO ALUNO — tela própria e simplificada pra quem loga com um
   acesso "aluno": só os dados dele (mensalidade, histórico, turmas) e
   troca de senha. Não usa o objeto `data` nem o shell de navegação do app
   de gestão — busca tudo direto de /api/aluno/me.
   ========================================================================== */

let alunoData = null;

async function bootAlunoPortal() {
  try {
    alunoData = await api.get('/api/aluno/me');
  } catch (e) {
    showToast('Erro ao carregar seus dados: ' + e.message, 'error');
    return;
  }
  document.getElementById('aluno-portal-screen').style.display = 'block';
  renderAlunoPortal();
}

function alunoMensalidadeDoMes() {
  const ym = currentYearMonth();
  return alunoData.pagamentos.find(t => monthKey(t.data) === ym &&
    (t.origem === 'auto-mensalidade' || (t.categoria || '').startsWith('MENSALIDADE') || t.categoria === 'AULA PARTICULAR'));
}

function renderAlunoPortal() {
  const { aluno, academiaNome, pagamentos, turmas } = alunoData;
  const mensalidadeAtual = alunoMensalidadeDoMes();

  let statusBadge = '';
  if (mensalidadeAtual) {
    const pago = mensalidadeAtual.status === 'recebido';
    const diasAtraso = pago ? 0 : daysBetween(mensalidadeAtual.data);
    const cls = pago ? 'status-ok' : (diasAtraso > 0 ? 'status-overdue' : 'status-pending');
    const label = pago ? '✓ Pago' : (diasAtraso > 0 ? `Atrasado (${diasAtraso}d)` : 'A vencer');
    statusBadge = `<span class="status-toggle ${cls}" style="cursor:default;">${label}</span>`;
  }

  document.getElementById('aluno-portal-screen').innerHTML = `
    <div class="login-wrap" style="align-items:flex-start;padding:40px 16px;">
      <div style="width:100%;max-width:640px;display:flex;flex-direction:column;gap:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div class="logo" style="font-size:18px;">🥋 ${escapeHtml(academiaNome)}</div>
            <div class="subtitle" style="margin:2px 0 0;">Olá, ${escapeHtml(aluno.nome)}</div>
          </div>
          <button class="btn btn-secondary" onclick="handleLogout()">🚪 Sair</button>
        </div>

        <div class="card">
          <h3>Mensalidade — ${monthLabel(currentYearMonth())}</h3>
          ${mensalidadeAtual ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:10px;">
              <div>
                <div style="font-size:22px;font-weight:700;">${fmtFull(mensalidadeAtual.valor)}</div>
                <div style="font-size:12px;color:var(--text2);">Vencimento: ${fmtDate(mensalidadeAtual.data)}</div>
              </div>
              ${statusBadge}
            </div>
          ` : `<p style="color:var(--text2);margin:8px 0 0;">Nenhuma mensalidade lançada para este mês ainda.</p>`}
        </div>

        <div class="card">
          <h3>Histórico de Pagamentos</h3>
          <div class="table-wrap table-responsive-cards">
            <table>
              <thead><tr><th style="text-align:left;">Data</th><th style="text-align:left;">Descrição</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>${pagamentos.length ? pagamentos.map(alunoPagamentoRow).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--text2);">Nenhum pagamento registrado.</td></tr>`}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h3>Grade de Turmas</h3>
          ${turmas.length ? turmas.map(t => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);">
              <strong>${escapeHtml(t.nome)}</strong>
              <div style="font-size:12px;color:var(--text2);">${(t.horarios || []).map(h => `${h.dia} ${h.hora}`).join(' · ') || '—'}</div>
            </div>
          `).join('') : `<p style="color:var(--text2);">Nenhuma turma cadastrada.</p>`}
        </div>

        <div class="card">
          <h3>Trocar Senha</h3>
          <div class="form-group"><label>Senha atual</label><input type="password" id="al-senha-atual" autocomplete="current-password"></div>
          <div class="form-group"><label>Nova senha</label><input type="password" id="al-senha-nova" autocomplete="new-password"></div>
          <div class="form-group"><label>Confirmar nova senha</label><input type="password" id="al-senha-confirmar" autocomplete="new-password"></div>
          <div id="al-senha-error"></div>
          <div class="btn-row"><button class="btn btn-primary" onclick="handleAlunoChangeSenha()">Trocar Senha</button></div>
        </div>
      </div>
    </div>
  `;
}

function alunoPagamentoRow(t) {
  const pago = t.status === 'recebido' || t.status === 'pago';
  return `<tr>
    <td data-label="Data">${fmtDate(t.data)}</td>
    <td data-label="Descrição" style="text-align:left;">${escapeHtml(t.descricao || t.categoria)}</td>
    <td data-label="Valor">${fmtFull(t.valor)}</td>
    <td data-label="Status"><span class="status-toggle ${pago ? 'status-ok' : 'status-pending'}" style="cursor:default;">${pago ? '✓ Pago' : 'Pendente'}</span></td>
  </tr>`;
}

async function handleAlunoChangeSenha() {
  const senhaAtual = document.getElementById('al-senha-atual').value;
  const novaSenha = document.getElementById('al-senha-nova').value;
  const confirmar = document.getElementById('al-senha-confirmar').value;
  const errorEl = document.getElementById('al-senha-error');
  errorEl.innerHTML = '';

  if (!senhaAtual || !novaSenha) { errorEl.innerHTML = `<div class="alert alert-danger">Preencha a senha atual e a nova senha.</div>`; return; }
  if (novaSenha.length < 6) { errorEl.innerHTML = `<div class="alert alert-danger">A nova senha precisa ter pelo menos 6 caracteres.</div>`; return; }
  if (novaSenha !== confirmar) { errorEl.innerHTML = `<div class="alert alert-danger">A confirmação não bate com a nova senha.</div>`; return; }

  try {
    await api.put('/api/aluno/senha', { senhaAtual, novaSenha });
    document.getElementById('al-senha-atual').value = '';
    document.getElementById('al-senha-nova').value = '';
    document.getElementById('al-senha-confirmar').value = '';
    showToast('Senha alterada com sucesso!');
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}
