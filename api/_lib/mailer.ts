import { env } from './env.js';
import { HttpError } from './http.js';

/** Envia um e-mail pelo Resend (https://resend.com/docs/api-reference/emails/send-email). */
export const sendEmail = async (to: string, subject: string, html: string, text: string): Promise<void> => {
  const apiKey = env.resendApiKey();
  const from = env.emailFrom();
  if (!apiKey || !from) {
    console.error('[mailer] RESEND_API_KEY ou EMAIL_FROM não configurados');
    throw new HttpError(503, 'Recuperação de senha indisponível no momento. Fale com o suporte.', 'EMAIL_NOT_CONFIGURED');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error('[mailer] falha ao enviar', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, 'Não foi possível enviar o e-mail. Tente novamente em instantes.');
  }
};
