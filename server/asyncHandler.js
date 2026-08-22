/* Envolve uma rota async pra qualquer promise rejeitada cair no middleware
   de erro do Express (server/index.js) em vez de ficar sem tratamento —
   no Express 4, uma rejeição não capturada numa rota async não vira uma
   resposta 500 sozinha, ela é engolida (ou, dependendo da versão do
   Node, derruba o processo inteiro, tirando o app do ar pra todas as
   academias por causa de uma requisição só). */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
