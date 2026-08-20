/* Envio de e-mail transacional via Resend (API HTTP simples, sem SDK —
   node 20 já tem fetch nativo). Se RESEND_API_KEY não estiver configurada,
   loga um aviso em vez de falhar — assim o resto do app segue funcionando
   mesmo antes do e-mail estar configurado. */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Gestão de Academia <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn(`[mailer] RESEND_API_KEY não configurada — e-mail para ${to} não foi enviado.`);
    return { sent: false };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      console.error(`[mailer] Erro ao enviar e-mail (${res.status}):`, await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error('[mailer] Falha ao enviar e-mail:', e.message);
    return { sent: false };
  }
}

module.exports = { sendEmail };
