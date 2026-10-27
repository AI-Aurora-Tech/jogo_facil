import { Resend } from 'resend';
import { env } from './env.js';
import { HttpError } from './http.js';

let client: Resend | null = null;

/**
 * Envia um e-mail pelo Resend. Usado só no código de recuperação de senha.
 * A chave fica em RESEND_API_KEY (Vercel), nunca no código.
 */
export const sendEmail = async (to: string, subject: string, html: string, text: string): Promise<void> => {
  const apiKey = env.resendApiKey();
  if (!apiKey) {
    console.error('[mailer] RESEND_API_KEY não configurada');
    throw new HttpError(503, 'Recuperação de senha indisponível no momento. Fale com o suporte.', 'EMAIL_NOT_CONFIGURED');
  }
  if (!client) client = new Resend(apiKey);

  const { error } = await client.emails.send({ from: env.emailFrom(), to, subject, html, text });
  if (error) {
    console.error('[mailer] falha ao enviar', error);
    throw new HttpError(502, 'Não foi possível enviar o e-mail. Tente novamente em instantes.');
  }
};
