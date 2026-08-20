/* Agenda o backup automático do banco (server/backup.js) pra rodar todo
   dia de madrugada, dentro do mesmo processo do app — sem precisar de um
   segundo serviço no Railway. Só agenda se as variáveis R2_* estiverem
   configuradas; caso contrário fica em silêncio (backup ainda não
   configurado, mas o resto do app segue funcionando normalmente). */

const cron = require('node-cron');
const { runBackup, r2Configurado } = require('./backup');

function scheduleBackups() {
  if (!r2Configurado()) {
    console.log('[backup] Backup automático não configurado (faltam variáveis R2_*) — pulando agendamento.');
    return;
  }
  // 03:15 America/Sao_Paulo — horário de menor uso, todo dia.
  cron.schedule('15 3 * * *', () => {
    console.log('[backup] Iniciando backup agendado...');
    runBackup();
  }, { timezone: 'America/Sao_Paulo' });
  console.log('[backup] Backup automático agendado para 03:15 (horário de Brasília), todo dia.');
}

module.exports = { scheduleBackups };
