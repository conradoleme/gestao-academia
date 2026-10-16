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
  iniciarSincronizacaoPortal();
}

function alunoMensalidadeDoMes() {
  const ym = currentYearMonth();
  return alunoData.pagamentos.find(t => monthKey(t.data) === ym &&
    (t.origem === 'auto-mensalidade' || (t.categoria || '').startsWith('MENSALIDADE') || t.categoria === 'AULA PARTICULAR'));
}

function renderAlunoPortal() {
  const { aluno, academiaNome, pagamentos, turmas, graduacao, recados, fichaMedicaPreenchida } = alunoData;
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
            <button class="btn btn-secondary" style="position:relative;" onclick="openAlunoFichaMedicaModal()">
              🏥 Ficha Médica
              ${fichaMedicaPreenchida ? '' : '<span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:var(--red);border:2px solid var(--surface);" title="Ficha médica pendente"></span>'}
            </button>
            <button class="btn btn-secondary" onclick="handleLogout()">🚪 Sair</button>
          </div>
        </div>

        ${renderAlunoMural(recados)}

        ${renderAlunoGraduacaoCard(graduacao)}

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
        <div style="position:sticky;bottom:12px;z-index:5;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-md, 0 6px 20px rgba(0,0,0,0.12));padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;color:var(--text2);">Mensalidade · ${monthLabel(currentYearMonth())}</div>
            ${mensalidadeAtual ? `
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
                <span style="font-size:18px;font-weight:700;">${fmtFull(mensalidadeAtual.valor)}</span>
                <span style="font-size:12px;color:var(--text2);">vence ${fmtDate(mensalidadeAtual.data)}</span>
              </div>
            ` : `<div style="font-size:13px;color:var(--text2);margin-top:2px;">Nenhuma mensalidade lançada ainda.</div>`}
          </div>
          ${statusBadge}
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

function hexToRgba(hex, alpha) {
  const h = String(hex || '#000000').replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(f, 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* Miniatura da faixa: bolinha da cor, ou a faixa desenhada com a listra no
   meio quando ela tem (ex: laranja e preta). */
function alunoFaixaMini(cor, corListra, largura = 34, altura = 14) {
  if (!corListra) {
    return `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${cor};border:1px solid var(--border);vertical-align:-2px;"></span>`;
  }
  return `<span style="display:inline-block;width:${largura}px;height:${altura}px;border-radius:3px;border:1px solid var(--border);vertical-align:middle;background:linear-gradient(to bottom,${cor} 0 36%,${corListra} 36% 64%,${cor} 64% 100%);"></span>`;
}

/* Barra de evolução em aulas, como um objetivo a alcançar: o preenchimento
   vai da cor da faixa atual pra cor da próxima (degradê) e, se a próxima faixa
   tem listra, ela aparece no meio da barra bem clarinha a partir da metade e
   cada vez mais forte até o 4º grau. Os graus são marcos na própria barra. */
function alunoBarraEvolucao(g) {
  const pct = Math.min(1, g.totalAulas / (g.minAulas || 1));
  const pc = Math.round(pct * 100);
  const c1 = g.cor, c2 = g.proximaCor || g.cor, s1 = g.corListra, s2 = g.proximaCorListra;
  const base = c1 !== c2 ? `linear-gradient(90deg,${c1},${c2})` : c1;
  const faixaListra = 'position:absolute;left:0;right:0;top:50%;height:6px;transform:translateY(-50%);';
  let listras = '';
  if (s1) listras += `<div style="${faixaListra}background:${s1};"></div>`;
  if (s2 && s2 !== s1) {
    listras += `<div style="${faixaListra}background:linear-gradient(90deg,${hexToRgba(s2, 0)} 0%,${hexToRgba(s2, 0)} 49.9%,${hexToRgba(s2, 0.12)} 50%,${hexToRgba(s2, 1)} 100%);"></div>`;
  }
  const mascara = `<div style="position:absolute;top:0;bottom:0;right:0;width:${100 - pc}%;background:var(--surface2);"></div>`;

  const marcos = [];
  if (g.usaGrau) { for (let k = 1; k <= 4; k++) marcos.push({ at: k / 4, n: Math.round(g.minAulas * k / 4), grau: k, fim: k === 4 }); }
  else { marcos.push({ at: 0.5, n: Math.round(g.minAulas / 2), grau: 0, fim: false }, { at: 1, n: g.minAulas, grau: 0, fim: true }); }

  const marcosHtml = marcos.map(m => {
    const feito = g.totalAulas >= m.n;
    let miolo;
    if (m.fim) {
      miolo = s2
        ? `<span style="width:36px;height:22px;border-radius:4px;border:2px solid var(--surface);box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;background:linear-gradient(to bottom,${c2} 0 36%,${s2} 36% 64%,${c2} 64% 100%);font-size:11px;color:#fff;">${feito ? '<span style="background:#111;border-radius:50%;width:15px;height:15px;line-height:15px;text-align:center;">✓</span>' : ''}</span>`
        : `<span style="width:26px;height:26px;border-radius:50%;background:${c2};border:2px solid var(--surface);box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;font-size:13px;">${feito ? '✓' : '🏁'}</span>`;
    } else {
      miolo = `<span style="width:22px;height:22px;border-radius:50%;background:${feito ? 'var(--text)' : 'var(--surface)'};border:${feito ? '2px solid var(--surface)' : '1.5px dashed var(--text2)'};box-shadow:${feito ? '0 0 0 1px var(--border)' : 'none'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${feito ? 'var(--surface)' : 'var(--text2)'};">${feito ? '✓' : (m.grau || '')}</span>`;
    }
    const rotulo = m.fim ? g.proximaFaixa : (m.grau ? m.grau + 'º grau' : 'metade');
    return `<div style="position:absolute;left:${Math.round(m.at * 100)}%;top:-5px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;max-width:76px;text-align:center;">
      ${miolo}
      <span style="font-size:11px;margin-top:6px;line-height:1.25;color:${feito ? 'var(--text)' : 'var(--text2)'};font-weight:${feito ? 700 : 400};">${escapeHtml(rotulo)}</span>
      <span style="font-size:10.5px;color:var(--text2);white-space:nowrap;">${m.n} aulas</span>
    </div>`;
  }).join('');

  const proximo = marcos.find(m => g.totalAulas < m.n);
  const falta = proximo ? proximo.n - g.totalAulas : 0;
  const metaTxt = proximo
    ? `<span style="font-size:18px;">🎯</span><span>Próxima meta: <strong>${proximo.fim ? 'faixa ' + escapeHtml(g.proximaFaixa) : proximo.grau ? proximo.grau + 'º grau' : 'metade do caminho'}</strong> em ${falta} aula${falta > 1 ? 's' : ''}.</span>`
    : `<span style="font-size:18px;">🏆</span><span>Aulas completas! Falta a avaliação do seu instrutor para a faixa <strong>${escapeHtml(g.proximaFaixa)}</strong>.</span>`;

  return `
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:26px;">
      <span>Aulas treinadas na faixa</span><strong style="color:var(--text);">${g.totalAulas}/${g.minAulas}</strong>
    </div>
    <div style="position:relative;margin:0 28px 52px 12px;">
      <div style="position:absolute;left:${pc}%;top:-20px;transform:translateX(-50%);font-size:11px;font-weight:700;white-space:nowrap;">${g.totalAulas} ▾</div>
      <div style="position:relative;height:16px;border-radius:999px;border:1px solid var(--border);overflow:hidden;background:${base};">${listras}${mascara}</div>
      ${marcosHtml}
    </div>
    <div style="display:flex;align-items:center;gap:8px;font-size:13px;background:var(--surface2);border-radius:10px;padding:10px 12px;">${metaTxt}</div>`;
}

function renderAlunoGraduacaoCard(g) {
  if (!g) return '';

  // Cor da faixa vai no fundo/borda, nunca no texto — faixas claras (ex:
  // Branca) ficam ilegíveis se o texto usar a cor da própria faixa.
  const faixaTag = `<span class="tag" style="display:inline-flex;align-items:center;gap:8px;background:${g.cor}22;color:var(--text);border:1px solid ${g.cor}88;font-size:13px;">${alunoFaixaMini(g.cor, g.corListra)}${escapeHtml(g.faixaAtual)}${g.usaGrau && g.grau ? ' · ' + g.grau + '°' : ''}</span>`;

  if (g.semRegra) {
    return `<div class="card">
      <h3>🥋 Evolução</h3>
      <div style="margin-top:8px;">${faixaTag}</div>
      <p style="color:var(--text2);margin:12px 0 0;">Você está na faixa máxima configurada pela academia. 🏆</p>
    </div>`;
  }

  const proxima = `<span style="display:inline-flex;align-items:center;gap:8px;color:var(--text2);">→ rumo a ${alunoFaixaMini(g.proximaCor || g.cor, g.proximaCorListra)} <strong style="color:var(--text);">${escapeHtml(g.proximaFaixa)}</strong></span>`;
  const faltamAulas = Math.max(0, g.minAulas - g.totalAulas);

  if (g.pronto) {
    return `<div class="card">
      <h3>🥋 Evolução</h3>
      <div style="margin:8px 0 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${faixaTag} ${proxima}</div>
      ${alunoBarraEvolucao(g)}
      <p style="margin:14px 0 0;font-weight:600;">🎉 Você já bateu os critérios pra próxima faixa! Fala com seu instrutor.</p>
      ${alunoAvaliacaoDisclaimer()}
    </div>`;
  }

  return `<div class="card">
    <h3>🥋 Evolução</h3>
    <div style="margin:8px 0 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${faixaTag} ${proxima}</div>

    ${alunoBarraEvolucao(g)}

    ${g.minAulasRecentes > 0 ? `<div style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:4px;">
        <span>Aulas nos últimos ${g.janelaDias} dias</span><span>${g.aulasRecentes}/${g.minAulasRecentes}</span>
      </div>
      ${alunoBarra(g.aulasRecentes / g.minAulasRecentes, g.okRecentes ? 'var(--green)' : 'var(--accent)')}
    </div>` : ''}

    <p style="color:var(--text2);font-size:12.5px;margin:14px 0 0;">
      ${faltamAulas > 0 ? '' : 'Aulas — feito ✓.'}${!g.okRecentes ? ` Treine mais nas próximas semanas pra manter o ritmo recente.` : ''}
    </p>

    ${alunoSimulacaoGraduacao(g)}
    ${alunoAvaliacaoDisclaimer()}
  </div>`;
}

function alunoAvaliacaoDisclaimer() {
  return `<p style="font-size:11.5px;color:var(--text2);background:var(--surface2);border-radius:8px;padding:8px 10px;margin:14px 0 0;">
    ⚠️ Bater esses números não garante a graduação automaticamente — a decisão final é sempre do seu instrutor, que avalia técnica e postura no tatame.
  </p>`;
}

/* Previsão em aulas: o prazo depende só do ritmo do aluno. Mostra o ritmo
   real dos últimos dias e três cenários fixos (1x/2x/3x por semana). */
function alunoSimulacaoGraduacao(g) {
  const faltamAulas = Math.max(0, g.minAulas - g.totalAulas);
  const fmt = semanas => new Date(Date.now() + semanas * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

  let ritmoLinha;
  if (faltamAulas === 0) {
    ritmoLinha = 'Você já tem as aulas necessárias.';
  } else if (g.ritmoSemanal > 0) {
    const semanas = Math.ceil(faltamAulas / g.ritmoSemanal);
    ritmoLinha = `No seu ritmo (<strong>${g.ritmoSemanal.toFixed(1)}</strong> aula(s)/semana nos últimos ${g.janelaDias} dias): ~<strong>${semanas}</strong> semana(s), por volta de ${fmt(semanas)}.`;
  } else {
    ritmoLinha = `Sem aulas nos últimos ${g.janelaDias} dias — volte a treinar pra retomar a contagem do prazo.`;
  }

  const cenarios = faltamAulas === 0 ? [] : [1, 2, 3].map(freq => {
    const semanas = Math.ceil(faltamAulas / freq);
    return `<div class="simulacao-row" style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border-radius:8px;padding:8px 12px;">
      <span style="font-size:13px;font-weight:600;">${freq}x por semana</span>
      <span style="font-size:12px;color:var(--text2);">~${semanas} semana(s) (${fmt(semanas)})</span>
    </div>`;
  });

  return `
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">
      <div style="font-size:13px;margin-bottom:${cenarios.length ? 10 : 0}px;">${ritmoLinha}</div>
      ${cenarios.length ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">Quanto mais você treina, mais cedo chega:</div>
      <div style="display:flex;flex-direction:column;gap:8px;">${cenarios.join('')}</div>` : ''}
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

