/* Cadastra (ou redefine a senha de) a conta do painel super-admin.
   Uso, sempre via `railway run` pra rodar contra o banco de produção:
     railway run node server/scripts/create-super-admin.js --email=voce@email.com --senha=SenhaForte123

   Se o e-mail já existir, atualiza a senha em vez de recusar — é o
   caminho de recuperação caso você esqueça a senha (não existe
   "esqueci minha senha" pro painel super-admin, de propósito: menos
   um canal de e-mail que, se comprometido, derruba a conta que
   gerencia todas as academias).
*/
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  });
  return args;
}

async function main() {
  const { email, senha } = parseArgs();
  if (!email || !senha) {
    console.error('Uso: node server/scripts/create-super-admin.js --email=voce@email.com --senha=SenhaForte123');
    process.exit(1);
  }
  if (senha.length < 6) {
    console.error('A senha precisa ter pelo menos 6 caracteres.');
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const [existing] = await pool.query('SELECT id FROM super_admins WHERE email = ?', [email]);

  if (existing[0]) {
    await pool.query('UPDATE super_admins SET senha_hash = ? WHERE id = ?', [senhaHash, existing[0].id]);
    console.log(`Senha atualizada para ${email}.`);
  } else {
    await pool.query('INSERT INTO super_admins (email, senha_hash) VALUES (?, ?)', [email, senhaHash]);
    console.log(`Conta super-admin criada: ${email}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
