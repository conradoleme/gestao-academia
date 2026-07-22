/* Pool de conexão MySQL. Lê primeiro as variáveis que o plugin MySQL do
   Railway injeta automaticamente (MYSQLHOST, etc.), com fallback para as
   variáveis DB_* do .env local (docker-compose). */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'academia',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // evita o MySQL2/Node deslocar colunas DATE por fuso horário
});

module.exports = pool;
