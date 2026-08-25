/* Erro de query do MySQL2 carrega um campo .sql com a query já interpolada
   com os valores reais enviados — nome, e-mail, telefone, dado de ficha
   médica, o que for. console.error(err) direto imprime tudo isso no log
   do Railway. Aqui loga só o que ajuda a diagnosticar (mensagem, código,
   sqlState), nunca o texto da query nem os parâmetros. */
function logSafeError(context, err) {
  console.error(context, { message: err.message, code: err.code, sqlState: err.sqlState });
}

module.exports = { logSafeError };
