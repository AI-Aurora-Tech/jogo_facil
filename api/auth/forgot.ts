import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabaseAdmin.js';
import { env } from '../_lib/env.js';
import { sendEmail } from '../_lib/mailer.js';
import { generateResetCode, hashResetCode, normalizeEmail, RESET_CODE_MINUTES } from '../_lib/passwords.js';

/**
 * POST /api/auth/forgot { email } -> { message }
 *
 * Envia por e-mail um código de 6 dígitos, de uso único, válido por 15 minutos.
 * A resposta é sempre a mesma, exista ou não a conta, para não revelar quais e-mails estão cadastrados.
 */

const GENERIC_MESSAGE = 'Se o e-mail estiver cadastrado, você vai receber um código em instantes. Confira também o spam.';
/** Intervalo mínimo entre dois códigos para a mesma conta. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Máximo de códigos por conta por hora. */
const MAX_CODES_PER_HOUR = 5;

export const POST = handle(async request => {
  const body = await readJson<{ email?: string }>(request);
  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) throw new HttpError(400, 'Informe o e-mail cadastrado.');

  // Checa a configuração antes de procurar a conta, para o erro não depender do e-mail existir
  if (!env.resendApiKey() || !env.emailFrom()) {
    console.error('[forgot] RESEND_API_KEY ou EMAIL_FROM não configurados');
    throw new HttpError(503, 'Recuperação de senha indisponível no momento. Fale com o suporte.', 'EMAIL_NOT_CONFIGURED');
  }

  const { data: user, error } = await db().from('user').select('id, email, name').eq('email', email).maybeSingle();
  if (error) throw error;
  if (!user) return json({ message: GENERIC_MESSAGE });

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent, error: recentError } = await db()
    .from('password_reset')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false });
  if (recentError) throw recentError;
  const last = recent?.[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
  if ((recent?.length || 0) >= MAX_CODES_PER_HOUR || Date.now() - last < RESEND_COOLDOWN_SECONDS * 1000) {
    return json({ message: GENERIC_MESSAGE });
  }

  // Só o código mais recente vale
  const now = new Date();
  await db().from('password_reset').update({ used_at: now.toISOString() }).eq('user_id', user.id).is('used_at', null);

  const code = generateResetCode();
  const { error: insertError } = await db().from('password_reset').insert([{
    user_id: user.id,
    code_hash: hashResetCode(code),
    expires_at: new Date(now.getTime() + RESET_CODE_MINUTES * 60_000).toISOString(),
  }]);
  if (insertError) throw insertError;

  const firstName = String(user.name || '').split(' ')[0] || 'craque';
  try {
    await sendEmail(
      user.email,
      `Seu código do Jogo Fácil: ${code}`,
      `<p>Olá, ${escapeHtml(firstName)}!</p>
       <p>Use o código abaixo para criar uma nova senha no Jogo Fácil:</p>
       <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
       <p>Ele vale por ${RESET_CODE_MINUTES} minutos e só pode ser usado uma vez.</p>
       <p>Se não foi você quem pediu, ignore este e-mail. Sua senha continua a mesma.</p>`,
      `Olá, ${firstName}!\n\nSeu código para criar uma nova senha no Jogo Fácil: ${code}\n\n` +
        `Ele vale por ${RESET_CODE_MINUTES} minutos e só pode ser usado uma vez.\n` +
        'Se não foi você quem pediu, ignore este e-mail. Sua senha continua a mesma.'
    );
  } catch (err) {
    // Não devolve erro aqui: um erro só para contas que existem revelaria o cadastro
    console.error('[forgot] envio do código falhou', err);
  }

  return json({ message: GENERIC_MESSAGE });
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
