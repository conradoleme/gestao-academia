/* Cliente Stripe — cobra a ASSINATURA DA PLATAFORMA (cada academia paga
   pra usar o sistema). Nada aqui tem relação com como a academia cobra
   os próprios alunos — isso continua manual, fora do Stripe. */
const Stripe = require('stripe');

function stripeConfigurado() {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client = null;
function getStripeClient() {
  if (!client) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY não configurado.');
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

module.exports = { getStripeClient, stripeConfigurado };
