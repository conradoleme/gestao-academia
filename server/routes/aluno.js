/* Portal do aluno — acesso restrito só aos próprios dados. Diferente das
   rotas em /api/*, aqui NÃO existe visão da academia inteira: cada consulta
   é presa a req.alunoId (vindo do token), nunca a um id recebido do cliente.
   Trocar senha não mora aqui — o aluno usa "Esqueci minha senha" na tela
   de login, igual todo mundo. */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { studentToJSON, turmaToJSON, txToJSON } = require('../mappers');
const asyncHandler = require('../asyncHandler');

router.use((req, res, next) => {
  if (req.role !== 'aluno') return res.status(403).json({ error: 'Acesso restrito ao portal do aluno.' });
  if (!req.alunoId) return res.status(404).json({ error: 'Este acesso não está vinculado a um aluno.' });
  next();
});

/* Mesmo cálculo mostrado pro instrutor no menu Graduação
   (public/js/store.js: computeGraduacaoStatus) — replicado aqui porque o
   portal do aluno não recebe o restante da base (presença/faixa de outros
   alunos) pra rodar isso no cliente. Nunca promove sozinho — só calcula
   "atingiu o critério". */
function computeGraduacaoStatus(aluno, graduacaoRegras, presencas, graduacoes) {
  const faixas = (graduacaoRegras && graduacaoRegras[aluno.categoria === 'Kids' ? 'Kids' : 'Adulto']) || [];
  if (!faixas.length) return null;

  const faixaAtualNome = aluno.faixa || faixas[0].nome;
  const idx = faixas.findIndex(f => f.nome === faixaAtualNome);
  const faixaAtual = idx >= 0 ? faixas[idx] : faixas[0];
  const proximaFaixa = idx >= 0 && idx + 1 < faixas.length ? faixas[idx + 1] : null;
  const regra = faixaAtual.regra;

  if (!regra) {
    return { faixaAtual: faixaAtual.nome, cor: faixaAtual.cor, proximaFaixa: null, semRegra: true };
  }

  const graduacoesAluno = graduacoes.filter(g => g.faixaNova === faixaAtualNome).sort((a, b) => b.data.localeCompare(a.data));
  const dataAncora = graduacoesAluno[0]?.data || aluno.dataInicio;

  if (!dataAncora) {
    return { faixaAtual: faixaAtual.nome, cor: faixaAtual.cor, proximaFaixa: proximaFaixa?.nome || null, semDataInicio: true, regra };
  }

  const hoje = new Date();
  const [ay, am, ad] = dataAncora.split('-').map(Number);
  const ancora = new Date(ay, am - 1, ad);
  const meses = (hoje.getFullYear() - ancora.getFullYear()) * 12 + (hoje.getMonth() - ancora.getMonth());

  const totalAulas = presencas.filter(p => p.data >= dataAncora).length;

  const noventaDiasAtras = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const presencasRecentes = presencas.filter(p => p.data >= noventaDiasAtras).length;
  const frequenciaSemanal = presencasRecentes / (90 / 7);

  const okMeses = meses >= regra.minMeses;
  const okAulas = totalAulas >= regra.minAulas;
  const okFrequencia = frequenciaSemanal >= regra.minFrequenciaSemanal;
  const pronto = okMeses && okAulas && okFrequencia;

  return {
    faixaAtual: faixaAtual.nome, cor: faixaAtual.cor, proximaFaixa: proximaFaixa?.nome || null,
    dataAncora, meses, minMeses: regra.minMeses, okMeses,
    totalAulas, minAulas: regra.minAulas, okAulas,
    frequenciaSemanal, minFrequenciaSemanal: regra.minFrequenciaSemanal, okFrequencia,
    pronto, avaliacaoManual: !!regra.avaliacaoManual,
  };
}

router.get('/me', asyncHandler(async (req, res) => {
  const [studentRows] = await pool.query('SELECT * FROM students WHERE id = ? AND academia_id = ?', [req.alunoId, req.academiaId]);
  if (!studentRows[0]) return res.status(404).json({ error: 'Aluno não encontrado.' });
  const aluno = studentToJSON(studentRows[0]);

  const [txRows] = await pool.query(
    'SELECT * FROM transactions WHERE aluno_id = ? AND academia_id = ? ORDER BY data DESC',
    [req.alunoId, req.academiaId]
  );

  // Só a própria turma — não a grade inteira da academia.
  const [turmaRows] = aluno.turma
    ? await pool.query('SELECT * FROM turmas WHERE academia_id = ? AND nome = ?', [req.academiaId, aluno.turma])
    : [[]];

  const [academiaRows] = await pool.query('SELECT nome, graduacao_regras FROM academias WHERE id = ?', [req.academiaId]);
  const [presencaRows] = await pool.query('SELECT data FROM presencas WHERE aluno_id = ? AND academia_id = ?', [req.alunoId, req.academiaId]);
  const [graduacaoRows] = await pool.query('SELECT data, faixa_nova FROM graduacoes WHERE aluno_id = ? AND academia_id = ?', [req.alunoId, req.academiaId]);

  const graduacaoRegras = academiaRows[0]?.graduacao_regras || {};
  const presencas = presencaRows.map(r => ({ data: r.data }));
  const graduacoes = graduacaoRows.map(r => ({ data: r.data, faixaNova: r.faixa_nova }));

  res.json({
    academiaNome: academiaRows[0]?.nome || '',
    aluno,
    pagamentos: txRows.map(txToJSON),
    turmas: turmaRows.map(turmaToJSON),
    graduacao: computeGraduacaoStatus(aluno, graduacaoRegras, presencas, graduacoes),
  });
}));

module.exports = router;
