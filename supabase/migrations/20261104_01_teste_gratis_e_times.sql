-- =============================================================================
-- JOGO FÁCIL - Passo 7: 30 dias grátis para donos de time + localização do time
--
-- Rode ANTES do deploy desta versão (o app passa a ler user.trial_ends_at).
--
-- - user.trial_ends_at: fim do teste grátis. Contas novas ganham 30 dias a partir do cadastro.
--   Donos de time que já existem ganham 30 dias a partir de hoje.
--   Depois do teste, a mensalidade é R$ 19,99/mês (qualquer quantidade de categorias).
--   O navegador não consegue alterar essa data (só o servidor).
-- - Localização do time (user.latitude/longitude, já existentes) é usada na aba "Times"
--   para o filtro por distância.
-- =============================================================================

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

UPDATE "user"
SET trial_ends_at = NOW() + INTERVAL '30 days'
WHERE role = 'TEAM_CAPTAIN' AND trial_ends_at IS NULL
  AND COALESCE(billing_status, '') <> 'ACTIVE';

-- O cadastro pelo app não pode escolher a data do teste
CREATE OR REPLACE FUNCTION user_trial_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json->>'role',
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
BEGIN
  IF v_role IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.trial_ends_at := NOW() + INTERVAL '30 days';
    ELSIF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      NEW.trial_ends_at := OLD.trial_ends_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_trial_guard ON "user";
CREATE TRIGGER trg_user_trial_guard
BEFORE INSERT OR UPDATE ON "user"
FOR EACH ROW EXECUTE FUNCTION user_trial_guard();
