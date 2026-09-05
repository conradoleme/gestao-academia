/* Cobrança (ver e marcar como pago) é só do dono — operação não lida mais
   com essa tela. O POST fica aberto pros dois papéis porque é usado tanto
   pela geração automática de mensalidade do mês (dispara pra quem quer que
   logue primeiro, admin ou operação) quanto pelo botão manual "Gerar
   Mensalidades" na tela de Alunos, que continua disponível pra operação. */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { txToJSON } = require('../mappers');
const { requireRole } = require('../auth');
const asyncHandler = require('../asyncHandler');

const STATUS_VALIDOS = ['a_receber', 'recebido'];

router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM transactions WHERE academia_id = ? AND aluno_id IS NOT NULL',
    [req.academiaId]
  );
  res.json(rows.map(txToJSON));
}));

router.post('/', asyncHandler(async (req, res) => {
  const t = req.body || {};
  if (!t.alunoId) return res.status(400).json({ error: 'Informe o aluno.' });
  if (!t.data || !t.categoria || !t.status) return res.status(400).json({ error: 'Dados incompletos para o lançamento.' });
  if (!STATUS_VALIDOS.includes(t.status)) return res.status(400).json({ error: 'Status inválido.' });

  // grupo/tipo fixos em receita/entrada — essa rota nunca cria despesa.
  // dedup_key só é preenchido pra lançamentos auto-* (é o que a trave
  // uq_transactions_dedup usa) — manual (origem null/outro) fica NULL e
  // nunca colide, então continua livre pra lançar quantas vezes quiser.
  const origemAuto = t.origem === 'auto-mensalidade' || t.origem === 'auto-matricula';
  const dedupKey = origemAuto ? `${req.academiaId}|${t.alunoId}|${t.categoria}|${t.data}|${t.origem}` : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO transactions (academia_id, data, grupo, categoria, descricao, valor, status, tipo, aluno_id, origem, recorrente, recorrencia_meses, dedup_key)
       VALUES (?,?,'receita',?,?,?,?,'entrada',?,?,0,NULL,?)`,
      [req.academiaId, t.data, t.categoria, t.descricao || null, t.valor || 0, t.status, t.alunoId, t.origem || null, dedupKey]
    );
    const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [result.insertId]);
    res.json(txToJSON(rows[0]));
  } catch (e) {
    // Duas sessões gerando o mês quase ao mesmo tempo (dono + funcionário
    // logando junto, por ex.) corriam pra criar o mesmo lançamento — a
    // trava uq_transactions_dedup barra a segunda, e aqui devolvemos o
    // registro que já existe em vez de dar erro, então quem chamou nem
    // percebe que perdeu a corrida.
    if (e.code === 'ER_DUP_ENTRY' && t.origem) {
      const [existing] = await pool.query(
        'SELECT * FROM transactions WHERE academia_id = ? AND aluno_id = ? AND categoria = ? AND data = ? AND origem = ?',
        [req.academiaId, t.alunoId, t.categoria, t.data, t.origem]
      );
      if (existing[0]) return res.json(txToJSON(existing[0]));
    }
    throw e;
  }
}));

router.put('/:id/status', requireRole('admin'), asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ error: 'Status inválido.' });

  const [rows] = await pool.query(
    'SELECT id FROM transactions WHERE id = ? AND academia_id = ? AND aluno_id IS NOT NULL',
    [req.params.id, req.academiaId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Lançamento não encontrado.' });

  await pool.query('UPDATE transactions SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
