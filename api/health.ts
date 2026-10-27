import { json } from './_lib/http.js';
import { env } from './_lib/env.js';
import { db } from './_lib/supabaseAdmin.js';

/**
 * GET /api/health — diagnóstico da configuração (abra no navegador).
 * Mostra só se cada item está OK; nunca mostra valores de chaves.
 */
export const GET = async (): Promise<Response> => {
  const vars = {
    SUPABASE_URL: !!env.supabaseUrl(),
    SUPABASE_SERVICE_ROLE_KEY: !!env.supabaseServiceKey(),
    SESSION_SECRET: !!env.sessionSecret(),
    RESEND_API_KEY: !!env.resendApiKey(),
    APP_URL: !!env.appUrl(),
  };

  const checks: Record<string, string> = {};
  if (vars.SUPABASE_URL && vars.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await db().from('user').select('id').limit(1);
      checks.banco = error ? `ERRO: ${error.message}` : 'OK';
      const { error: tblErr } = await db().from('match_invite').select('id').limit(1);
      checks.migracao_partidas = tblErr ? `FALTA rodar 20261022_01_fluxo_partidas_pagamentos.sql (${tblErr.message})` : 'OK';
      const { error: resetErr } = await db().from('password_reset').select('id').limit(1);
      checks.migracao_senha = resetErr ? `FALTA rodar 20261023_01_senha_pelo_servidor.sql (${resetErr.message})` : 'OK';
    } catch (e: any) {
      checks.banco = `ERRO: ${e?.message || e}`;
    }
  } else {
    checks.banco = 'Não testado: configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY';
  }

  const missing = Object.entries(vars).filter(([, v]) => v === false).map(([k]) => k);
  const ok = missing.length === 0 && Object.values(checks).every(v => v === 'OK');
  return json({ ok, faltando_na_vercel: missing, variaveis: vars, verificacoes: checks }, ok ? 200 : 500);
};
