/* Cadastra uma nova academia (uso: uma vez por academia, por linha de comando).
   Exemplo:
     node server/scripts/create-academia.js --email=dono@academia.com --senha=SenhaForte123 --nome="GOUSHI Jiu Jitsu"

   Passe --turmas-padrao=true se quiser já entrar com a grade de horários
   original da GOUSHI (T730..T2000) em vez de começar sem nenhuma turma —
   útil pra recriar a conta da GOUSHI depois da migração para login+MySQL.
*/
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { DEFAULT_CATEGORY_GROUPS, DEFAULT_COBRANCA_TEMPLATES, DEFAULT_TURMAS, buildDefaultTransactions } = require('../seed-defaults');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  });
  return args;
}

async function main() {
  const { email, senha, nome, 'turmas-padrao': turmasPadrao } = parseArgs();
  if (!email || !senha) {
    console.error('Uso: node server/scripts/create-academia.js --email=dono@academia.com --senha=SenhaForte123 --nome="Nome da Academia"');
    process.exit(1);
  }

  const [existing] = await pool.query('SELECT id FROM academias WHERE email = ?', [email]);
  if (existing[0]) {
    console.error(`Já existe uma academia cadastrada com o e-mail ${email}.`);
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const [result] = await pool.query(
    `INSERT INTO academias (email, senha_hash, nome, generated_months, category_groups, cobranca_templates)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [email, senhaHash, nome || 'Minha Academia', JSON.stringify([]), JSON.stringify(DEFAULT_CATEGORY_GROUPS), JSON.stringify(DEFAULT_COBRANCA_TEMPLATES)]
  );

  if (turmasPadrao === 'true' || turmasPadrao === '1') {
    for (const t of DEFAULT_TURMAS) {
      await pool.query(
        `INSERT INTO turmas (academia_id, nome, horarios, freq_anterior, freq_atual) VALUES (?,?,?,?,?)`,
        [result.insertId, t.nome, JSON.stringify(t.horarios), t.freqAnterior, t.freqAtual]
      );
    }
    console.log(`${DEFAULT_TURMAS.length} turma(s) padrão criada(s).`);
  }

  const transacoes = buildDefaultTransactions();
  for (const tx of transacoes) {
    await pool.query(
      `INSERT INTO transactions (academia_id, data, grupo, categoria, descricao, valor, status, tipo, origem, recorrente)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [result.insertId, tx.data, tx.grupo, tx.categoria, tx.descricao, tx.valor, tx.status, tx.tipo, tx.origem, tx.recorrente ? 1 : 0]
    );
  }
  console.log(`${transacoes.length} lançamento(s) de despesa padrão criado(s).`);

  console.log(`Academia criada com sucesso! id=${result.insertId}, email=${email}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar academia:', err.message);
  process.exit(1);
});
