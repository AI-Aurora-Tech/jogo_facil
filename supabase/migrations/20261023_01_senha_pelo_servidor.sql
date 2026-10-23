-- =============================================================================
-- JOGO FÁCIL - Passo 3: senha só muda pelo servidor
--
-- Rode logo depois de publicar a versão com /api/auth/forgot, /api/auth/reset e
-- /api/auth/password (e depois do 20261022_02_endurecimento_colunas.sql).
--
-- - Cria a tabela dos códigos de recuperação de senha (só o servidor acessa).
-- - Tira do navegador (chave anon) a permissão de alterar a coluna "password".
--   Troca de senha, recuperação e troca pelo admin passam a ser feitas pelo
--   servidor (service role). O trigger hash_user_password continua fazendo o hash.
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_reset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- HMAC-SHA256 do código (o código em si nunca é gravado)
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset (user_id, created_at DESC);

-- Sem políticas: com RLS ligado, anon/authenticated não leem nem escrevem nada aqui
ALTER TABLE password_reset ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON password_reset FROM anon, authenticated;

-- ------------------------------------------------------------------- user ---
-- Revogar o UPDATE da tabela também remove os UPDATEs por coluna dados antes;
-- depois devolvemos as mesmas colunas do passo 2, menos "password".
REVOKE UPDATE ON "user" FROM anon, authenticated;
GRANT UPDATE (
  name, phone_number, teams, team_name, team_categories, team_logo_url,
  latitude, longitude
) ON "user" TO anon, authenticated;

-- O INSERT com senha continua liberado: é o cadastro de uma conta nova.
