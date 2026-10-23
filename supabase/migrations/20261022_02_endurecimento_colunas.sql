-- =============================================================================
-- JOGO FÁCIL - Passo 2: impedir que o navegador altere status, pagamento e assinatura
--
-- Rode SOMENTE depois que a nova versão do app (com as funções /api) estiver no ar.
-- A partir daqui, status da partida, pagamentos, placar e assinatura só mudam pelo
-- servidor (service role), que valida quem pode fazer cada ação.
-- =============================================================================

-- -------------------------------------------------------------- match_slot ---
REVOKE UPDATE ON match_slot FROM anon, authenticated;
GRANT UPDATE (
  date, time, duration_minutes, match_type, prize_description,
  has_local_team, local_team_name, local_team_category, local_team_phone,
  local_team_logo_url, local_team_gender, home_team_type,
  price, court_name, sport, allowed_opponent_categories, allowed_opponent_genders, pix_key
) ON match_slot TO anon, authenticated;

-- ------------------------------------------------------------------- user ---
REVOKE UPDATE ON "user" FROM anon, authenticated;
GRANT UPDATE (
  name, phone_number, password, teams, team_name, team_categories, team_logo_url,
  latitude, longitude
) ON "user" TO anon, authenticated;

REVOKE INSERT ON "user" FROM anon, authenticated;
GRANT INSERT (
  email, password, name, phone_number, role, subscription, teams,
  team_name, team_categories, team_logo_url, created_at
) ON "user" TO anon, authenticated;

-- ------------------------------------------------------------------ field ---
REVOKE UPDATE ON field FROM anon, authenticated;
GRANT UPDATE (
  name, location, hourly_rate, cancellation_fee_percent, pix_key, pix_name,
  image_url, contact_phone, latitude, longitude, courts, complement
) ON field TO anon, authenticated;

-- Ninguém se cadastra como administrador pelo app (exceto os e-mails do admin geral)
CREATE OR REPLACE FUNCTION user_block_admin_signup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IN ('SUPER_ADMIN', 'ADMIN')
     AND LOWER(NEW.email) NOT IN ('ai.auroratech@gmail.com', 'pedro@auroratech.com')
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Cadastro de administrador não permitido.';
  END IF;
  IF NEW.role NOT IN ('SUPER_ADMIN', 'ADMIN', 'FIELD_OWNER', 'TEAM_CAPTAIN') THEN
    RAISE EXCEPTION 'Tipo de conta inválido.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_block_admin_signup ON "user";
CREATE TRIGGER trg_user_block_admin_signup
BEFORE INSERT ON "user"
FOR EACH ROW EXECUTE FUNCTION user_block_admin_signup();
