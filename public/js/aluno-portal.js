/* ==========================================================================
   PORTAL DO ALUNO — tela própria e simplificada pra quem loga com um
   acesso "aluno": só os dados dele (mensalidade, histórico, turma e
   evolução de graduação). Não usa o objeto `data` nem o shell de
   navegação do app de gestão — busca tudo direto de /api/aluno/me.
   Trocar senha fica na tela de login ("Esqueci minha senha"), não aqui.
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
  const { aluno, academiaNome, pagamentos, turmas, graduacao, recados } = alunoData;
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
    <div class="login-wrap" style="align-items:flex-start;padding:32px 16px;">
      <div style="width:100%;max-width:760px;display:flex;flex-direction:column;gap:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div class="logo" style="font-size:18px;">🥋 ${escapeHtml(academiaNome)}</div>
            <div class="subtitle" style="margin:2px 0 0;">Olá, ${escapeHtml(aluno.nome)}</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" onclick="openAlunoFichaMedicaModal()">🏥 Ficha Médica</button>
            <button class="btn btn-secondary" onclick="handleLogout()">🚪 Sair</button>
          </div>
        </div>

        ${renderAlunoMural(recados)}

        <div class="card-grid card-grid-2">
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

          ${renderAlunoGraduacaoCard(graduacao)}
        </div>

        <div class="card">
          <h3>Minha Turma</h3>
          ${turmas.length ? turmas.map(t => `
            <div style="padding:8px 0;">
              <strong>${escapeHtml(t.nome)}</strong>
              <div style="font-size:12px;color:var(--text2);">${(t.horarios || []).map(h => `${h.dia} ${h.hora}`).join(' · ') || '—'}</div>
            </div>
          `).join('') : `<p style="color:var(--text2);">Você ainda não está matriculado(a) em nenhuma turma — fale com a academia.</p>`}
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
      </div>
    </div>
  `;
}

function renderAlunoMural(recados) {
  if (!recados || !recados.length) return '';
  return `
    <div class="card" style="border-left:3px solid var(--accent);">
      <h3 style="display:flex;align-items:center;gap:8px;margin:0 0 4px;">📢 Mural de Recados</h3>
      <div style="display:flex;flex-direction:column;">
        ${recados.map((r, i) => `
          <div style="padding:12px 0;${i < recados.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
            <strong style="font-size:14px;">${escapeHtml(r.titulo)}</strong>
            <p style="margin:4px 0 0;color:var(--text2);white-space:pre-wrap;font-size:13.5px;">${escapeHtml(r.mensagem)}</p>
            <div style="font-size:11px;color:var(--text2);margin-top:6px;">${new Date(r.createdAt).toLocaleDateString('pt-BR')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function alunoBarra(pct, cor) {
  return `<div style="background:var(--border);border-radius:999px;height:8px;overflow:hidden;">
    <div style="width:${Math.round(Math.min(1, pct) * 100)}%;height:100%;background:${cor};border-radius:999px;"></div>
  </div>`;
}

function renderAlunoGraduacaoCard(g) {
  if (!g) return '';

  const faixaTag = `<span class="tag" style="background:${g.cor}22;color:${g.cor};border:1px solid ${g.cor}55;font-size:13px;">${escapeHtml(g.faixaAtual)}</span>`;

  if (g.semRegra) {
    return `<div class="card">
      <h3>🥋 Evolução</h3>
      <div style="margin-top:8px;">${faixaTag}</div>
      <p style="color:var(--text2);margin:12px 0 0;">Você está na faixa máxima configurada pela academia. 🏆</p>
    </div>`;
  }

  if (g.semDataInicio) {
    return `<div class="card">
      <h3>🥋 Evolução</h3>
      <div style="margin-top:8px;">${faixaTag}</div>
      <p style="color:var(--text2);margin:12px 0 0;">Peça pro seu instrutor cadastrar sua data de início — assim dá pra acompanhar sua evolução até a faixa ${escapeHtml(g.proximaFaixa || 'seguinte')}.</p>
    </div>`;
  }

  if (g.pronto) {
    return `<div class="card">
      <h3>🥋 Evolução</h3>
      <div style="margin-top:8px;">${faixaTag} <span style="color:var(--text2);">→ rumo a <strong>${escapeHtml(g.proximaFaixa)}</strong></span></div>
      <p style="margin:14px 0 0;font-weight:600;">🎉 Você já bateu os critérios pra próxima faixa! Fala com seu instrutor.</p>
    </div>`;
  }

  const faltamMeses = Math.max(0, g.minMeses - g.meses);
  const faltamAulas = Math.max(0, g.minAulas - g.totalAulas);

  return `<div class="card">
    <h3>🥋 Evolução</h3>
    <div style="margin-top:8px;margin-bottom:14px;">${faixaTag} <span style="color:var(--text2);">→ rumo a <strong>${escapeHtml(g.proximaFaixa)}</strong></span></div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:4px;">
          <span>Tempo na faixa</span><span>${g.meses}/${g.minMeses} meses</span>
        </div>
        ${alunoBarra(g.meses / (g.minMeses || 1), g.okMeses ? 'var(--green)' : 'var(--accent)')}
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:4px;">
          <span>Aulas treinadas</span><span>${g.totalAulas}/${g.minAulas}</span>
        </div>
        ${alunoBarra(g.totalAulas / (g.minAulas || 1), g.okAulas ? 'var(--green)' : 'var(--accent)')}
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:4px;">
          <span>Frequência (últimos 90 dias)</span><span>${g.frequenciaSemanal.toFixed(1)}/${g.minFrequenciaSemanal}x por semana</span>
        </div>
        ${alunoBarra(g.frequenciaSemanal / (g.minFrequenciaSemanal || 1), g.okFrequencia ? 'var(--green)' : 'var(--accent)')}
      </div>
    </div>

    <p style="color:var(--text2);font-size:12.5px;margin:14px 0 0;">
      ${faltamAulas > 0 ? `Faltam <strong>${faltamAulas}</strong> aula(s)` : 'Aulas — feito ✓'}${faltamMeses > 0 ? ` e <strong>${faltamMeses}</strong> mês(es)` : ''} pra faixa ${escapeHtml(g.proximaFaixa)}.
    </p>
  </div>`;
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

/* ---------------- Ficha médica (a própria) ---------------- */
async function openAlunoFichaMedicaModal() {
  let f;
  try {
    f = await api.get('/api/aluno/ficha-medica');
  } catch (e) {
    showToast('Erro ao carregar sua ficha médica: ' + e.message, 'error');
    return;
  }
  openModal('Minha Ficha Médica', `
    <p style="color:var(--text2);font-size:12.5px;margin-bottom:14px;">Essas informações ficam disponíveis pra academia em caso de emergência.</p>
    ${fichaMedicaFormFields(f)}
    <div id="fm-error"></div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-primary" onclick="handleSaveAlunoFichaMedica()">Salvar</button>
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
  `, { width: '560px' });
}

async function handleSaveAlunoFichaMedica() {
  const errorEl = document.getElementById('fm-error');
  errorEl.innerHTML = '';
  try {
    await api.put('/api/aluno/ficha-medica', fichaMedicaFormPayload());
    closeModal();
    showToast('Ficha médica salva!');
  } catch (e) {
    errorEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
  }
}

