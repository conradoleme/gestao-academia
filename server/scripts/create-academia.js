/* Cadastra uma nova academia (uso: uma vez por academia, por linha de comando).
   Exemplo:
     node server/scripts/create-academia.js --email=dono@academia.com --senha=SenhaForte123 --nome="GOUSHI Jiu Jitsu"
*/
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

const DEFAULT_CATEGORY_GROUPS = {
  receita: ['MATRICULA KIDS','MATRICULA ADULTO','MENSALIDADE KIDS','MENSALIDADE ADULTO','KIMONO','PATCHES','MASCOTE','AULA PARTICULAR'],
  receitaFinanceira: ['RENDIMENTO DE APLICAÇÃO FINANCEIRA'],
  investimento: ['TREINAMENTO','EQUIPAMENTOS - COMPUTADORES','EQUIPAMENTOS - PERIFÉRICOS','AMBIENTE - MOBILIÁRIO','SOFTWARE - GESTÃO','MARKETING - COMUNICAÇÃO','MARKETING - VENDAS/FOLDERS/MÍDIA','MARKETING - GESTÃO MÍDIA SOCIAL','TATAME','EVENTO','APLICAÇÃO FINANCEIRA','PATCHES','KIMONOS','PLACA','ADESIVOS'],
  despesasOperacionais: ['PRO LABORE','COLABORADOR 1','COLABORADOR 2','COLABORADOR 3','ALUGUEL','CONDOMÍNIO','IPTU','SEGURO INCÊNDIO','TAXA BOLETO ALUGUEL','ESTACIONAMENTO','BENS DURÁVEIS DE PEQUENO VALOR','MATERIAL DE CONSUMO','MATERIAL ESCRITÓRIO - CONSUMÍVEIS','SERVIÇOS E MATERIAL DE LIMPEZA','MANUTENÇÃO - SERVIÇOS','MANUTENÇÃO - MATERIAIS','CONTABILIDADE','TFE','INSS','DARF','FGTS'],
  ctv: ['ISS - SOBRE FATURAMENTO','IRPJ','DAS','COMISSÃO'],
  despesasFinanceiras: ['TARIFA MOV CONTA','TARIFA PIX','TARIFA BOLETO','JUROS - CHEQUE ESPECIAL','ANUIDADE CARTÃO DE CRÉDITO','IOF - CONTA','IOF - CARTÃO','EMPRÉSTIMOS'],
};

const DEFAULT_COBRANCA_TEMPLATES = [
  { id: 'c1', nome: 'Lembrete', diasRelativoVencimento: -3, assunto: 'Lembrete: mensalidade {mes} vence em breve — {academia}',
    mensagem: 'Oi {nome}! Passando para lembrar que sua mensalidade de {valor} vence em {vencimento}. Qualquer dúvida, é só chamar. Bons treinos! 🥋' },
  { id: 'c2', nome: 'Vencimento', diasRelativoVencimento: 0, assunto: 'Sua mensalidade vence hoje — {academia}',
    mensagem: 'Oi {nome}, tudo bem? Sua mensalidade de {valor} vence hoje ({vencimento}). Se já pagou, desconsidere esta mensagem. Obrigado!' },
  { id: 'c3', nome: 'Atraso', diasRelativoVencimento: 5, assunto: 'Mensalidade em atraso — {academia}',
    mensagem: 'Oi {nome}! Notamos que sua mensalidade de {valor}, vencida em {vencimento}, ainda está em aberto ({diasAtraso} dias). Pode regularizar quando puder? Qualquer problema me avisa.' },
  { id: 'c4', nome: 'Atraso Grave', diasRelativoVencimento: 15, assunto: 'Importante: mensalidade em atraso há {diasAtraso} dias — {academia}',
    mensagem: 'Oi {nome}, sua mensalidade de {valor} está em aberto há {diasAtraso} dias (venceu em {vencimento}). Precisamos regularizar a situação — vamos conversar?' },
];

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  });
  return args;
}

async function main() {
  const { email, senha, nome } = parseArgs();
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

  console.log(`Academia criada com sucesso! id=${result.insertId}, email=${email}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar academia:', err.message);
  process.exit(1);
});
