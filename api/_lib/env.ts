/** Variáveis de ambiente (configurar em Vercel > Project > Settings > Environment Variables). */

const read = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
};

export const env = {
  supabaseUrl: () => read('SUPABASE_URL') || read('VITE_SUPABASE_URL'),
  supabaseServiceKey: () => read('SUPABASE_SERVICE_ROLE_KEY'),
  sessionSecret: () => read('SESSION_SECRET'),
  asaasApiKey: () => read('ASAAS_API_KEY'),
  /** 'production' ou 'sandbox' (padrão: sandbox, para não cobrar ninguém sem querer). */
  asaasEnv: () => (read('ASAAS_ENV') === 'production' ? 'production' : 'sandbox'),
  asaasWebhookToken: () => read('ASAAS_WEBHOOK_TOKEN'),
  /** % da taxa do jogo que fica com a plataforma. O resto vai direto para o dono do campo. */
  platformFeePercent: () => {
    const n = Number(read('PLATFORM_FEE_PERCENT') || '0');
    return Number.isFinite(n) && n >= 0 && n < 100 ? n : 0;
  },
  appUrl: () => (read('APP_URL') || '').replace(/\/$/, ''),
  /** Envio de e-mail (código de recuperação de senha) pelo Resend. */
  resendApiKey: () => read('RESEND_API_KEY'),
  /**
   * Remetente do e-mail. Sem domínio próprio verificado no Resend, use o de teste
   * (onboarding@resend.dev), que só entrega para o e-mail dono da conta Resend.
   */
  emailFrom: () => read('EMAIL_FROM') || 'Jogo Fácil <onboarding@resend.dev>',
};

export const requireEnv = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada.`);
  return value;
};
