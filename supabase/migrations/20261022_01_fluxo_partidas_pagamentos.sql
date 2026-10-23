-- =============================================================================
-- JOGO FÁCIL - Fluxo de partidas, pagamentos (Asaas), convites e avaliações
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez (idempotente).
-- NÃO apaga dados.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Usuário: dados de cobrança (mensalidade por categoria)
-- -----------------------------------------------------------------------------
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;
-- FREE | ACTIVE | PENDING | OVERDUE | CANCELED
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'FREE';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS billed_categories INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS billing_value NUMERIC DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS billing_updated_at TIMESTAMPTZ;
-- Conta criada a partir de um convite de partida
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS invited_by_invite UUID;

-- -----------------------------------------------------------------------------
-- 2. Campo: carteira de recebimento (split automático) e nota média
-- -----------------------------------------------------------------------------
ALTER TABLE field ADD COLUMN IF NOT EXISTS complement TEXT;
ALTER TABLE field ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT;
ALTER TABLE field ADD COLUMN IF NOT EXISTS asaas_account_id TEXT;
-- NONE | PENDING | ACTIVE
ALTER TABLE field ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'NONE';
ALTER TABLE field ADD COLUMN IF NOT EXISTS rating_avg NUMERIC DEFAULT 0;
ALTER TABLE field ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 3. Mensalista ligado a um usuário do app (para aprovar adversários e lançar placar)
-- -----------------------------------------------------------------------------
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS captain_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL;

-- Liga mensalistas já existentes pelo telefone ou e-mail do capitão
UPDATE registered_team rt
SET captain_user_id = u.id
FROM "user" u
WHERE rt.captain_user_id IS NULL
  AND (
    (rt.email IS NOT NULL AND LOWER(rt.email) = LOWER(u.email))
    OR (rt.captain_phone IS NOT NULL AND regexp_replace(rt.captain_phone, '\D', '', 'g') = regexp_replace(COALESCE(u.phone_number, ''), '\D', '', 'g'))
  );

-- -----------------------------------------------------------------------------
-- 4. Partida (match_slot)
-- -----------------------------------------------------------------------------
-- Colunas que o app já usava mas podem não existir no seu banco
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS booked_by_team_logo_url TEXT;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS booked_by_user_phone TEXT;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS booked_by_team_gender TEXT;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS allowed_opponent_genders TEXT[] DEFAULT '{}';
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- Quem é quem (ids de usuário)
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS home_team_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS opponent_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL;

-- Tipo de jogo: NORMAL | FESTIVAL | AMISTOSO (valores antigos ALUGUEL/FIXO = NORMAL)
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS prize_description TEXT;

-- Linha do tempo
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS opponent_applied_at TIMESTAMPTZ;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS team_approved_at TIMESTAMPTZ;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS field_decision_reason TEXT;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS post_match_notified_at TIMESTAMPTZ;

-- Pagamento (resumo para a tela; detalhes em match_payment)
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS first_team_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS opponent_paid BOOLEAN DEFAULT FALSE;

-- Resultado
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS home_score INTEGER;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS away_score INTEGER;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS result_notes TEXT;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS result_set_by UUID REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS result_set_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_match_slot_home_team_user ON match_slot(home_team_user_id);
CREATE INDEX IF NOT EXISTS idx_match_slot_opponent_user ON match_slot(opponent_user_id);
CREATE INDEX IF NOT EXISTS idx_match_slot_booked_by_user ON match_slot(booked_by_user_id);

-- Ao criar/editar um horário com mensalista ou time da casa, descobre o usuário dono
-- desse time e avisa ele (o jogo aparece direto na agenda do time).
CREATE OR REPLACE FUNCTION match_slot_resolve_home_team()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
  v_user UUID;
BEGIN
  IF NEW.has_local_team IS TRUE AND NEW.home_team_user_id IS NULL THEN
    IF NEW.home_team_type = 'LOCAL' THEN
      SELECT owner_id INTO v_owner FROM field WHERE id = NEW.field_id;
      NEW.home_team_user_id := v_owner;
    ELSIF NEW.home_team_type = 'MENSALISTA' THEN
      SELECT captain_user_id INTO v_user
      FROM registered_team
      WHERE field_id = NEW.field_id AND LOWER(name) = LOWER(NEW.local_team_name) AND captain_user_id IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1;
      IF v_user IS NULL AND NEW.local_team_phone IS NOT NULL THEN
        SELECT id INTO v_user FROM "user"
        WHERE regexp_replace(COALESCE(phone_number, ''), '\D', '', 'g') = regexp_replace(NEW.local_team_phone, '\D', '', 'g')
          AND regexp_replace(NEW.local_team_phone, '\D', '', 'g') <> ''
        LIMIT 1;
      END IF;
      NEW.home_team_user_id := v_user;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.home_team_type = 'MENSALISTA' AND NEW.home_team_user_id IS NOT NULL THEN
    INSERT INTO notification (user_id, title, description, type)
    VALUES (
      NEW.home_team_user_id,
      'Novo jogo na sua agenda 📅',
      'A arena criou um horário para o seu time em ' || to_char(NEW.date, 'DD/MM') || ' às ' || to_char(NEW.time, 'HH24:MI') ||
      '. Envie o convite para um adversário!',
      'info'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_match_slot_resolve_home_team ON match_slot;
CREATE TRIGGER trg_match_slot_resolve_home_team
BEFORE INSERT OR UPDATE OF has_local_team, home_team_type, local_team_name, local_team_phone ON match_slot
FOR EACH ROW EXECUTE FUNCTION match_slot_resolve_home_team();

-- Preenche os horários futuros já existentes (o UPDATE dispara o trigger acima)
UPDATE match_slot ms SET local_team_name = ms.local_team_name
WHERE ms.has_local_team IS TRUE AND ms.home_team_user_id IS NULL AND ms.date >= CURRENT_DATE;

-- -----------------------------------------------------------------------------
-- 5. Cobranças das partidas (uma por time pagante)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_payment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES match_slot(id) ON DELETE CASCADE,
  payer_role TEXT NOT NULL CHECK (payer_role IN ('FIRST', 'OPPONENT')),
  payer_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  team_name TEXT,
  amount NUMERIC NOT NULL,
  field_wallet_id TEXT,
  asaas_payment_id TEXT UNIQUE,
  invoice_url TEXT,
  pix_payload TEXT,
  pix_qr_base64 TEXT,
  pix_expires_at TIMESTAMPTZ,
  -- PENDING | PAID | REFUNDED | CANCELED | OVERDUE
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_match_payment_slot ON match_payment(slot_id);
-- Só uma cobrança "viva" por papel em cada partida
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_payment_active
  ON match_payment(slot_id, payer_role) WHERE status IN ('PENDING', 'PAID', 'OVERDUE');

-- -----------------------------------------------------------------------------
-- 6. Convites de partida
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_invite (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  slot_id UUID NOT NULL REFERENCES match_slot(id) ON DELETE CASCADE,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  category TEXT,
  expires_at TIMESTAMPTZ,
  opened_count INTEGER DEFAULT 0,
  used_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_match_invite_slot ON match_invite(slot_id);

-- -----------------------------------------------------------------------------
-- 7. Avaliações (time avalia o adversário e o campo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rating (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES match_slot(id) ON DELETE CASCADE,
  rater_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  rater_team_name TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('TEAM', 'FIELD')),
  target_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  target_team_name TEXT,
  target_field_id UUID REFERENCES field(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (slot_id, rater_user_id, target_type)
);
CREATE INDEX IF NOT EXISTS idx_rating_target_field ON rating(target_field_id);
CREATE INDEX IF NOT EXISTS idx_rating_target_team ON rating(target_user_id, target_team_name);

-- Nota média por time (dono + nome do time)
CREATE OR REPLACE VIEW team_rating_summary AS
SELECT
  target_user_id AS owner_user_id,
  LOWER(target_team_name) AS team_key,
  MAX(target_team_name) AS team_name,
  ROUND(AVG(score)::numeric, 2) AS rating_avg,
  COUNT(*)::int AS rating_count
FROM rating
WHERE target_type = 'TEAM'
GROUP BY target_user_id, LOWER(target_team_name);

-- Atualiza as médias do campo e do usuário a cada avaliação
CREATE OR REPLACE FUNCTION rating_refresh_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'FIELD' AND NEW.target_field_id IS NOT NULL THEN
    UPDATE field f SET
      rating_avg = sub.avg_score,
      rating_count = sub.cnt
    FROM (
      SELECT ROUND(AVG(score)::numeric, 2) AS avg_score, COUNT(*)::int AS cnt
      FROM rating WHERE target_type = 'FIELD' AND target_field_id = NEW.target_field_id
    ) sub
    WHERE f.id = NEW.target_field_id;
  ELSIF NEW.target_type = 'TEAM' AND NEW.target_user_id IS NOT NULL THEN
    UPDATE "user" u SET
      team_rating = sub.avg_score,
      team_rating_count = sub.cnt
    FROM (
      SELECT ROUND(AVG(score)::numeric, 2) AS avg_score, COUNT(*)::int AS cnt
      FROM rating WHERE target_type = 'TEAM' AND target_user_id = NEW.target_user_id
    ) sub
    WHERE u.id = NEW.target_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rating_refresh ON rating;
CREATE TRIGGER trg_rating_refresh
AFTER INSERT OR UPDATE ON rating
FOR EACH ROW EXECUTE FUNCTION rating_refresh_aggregates();

-- -----------------------------------------------------------------------------
-- 8. Log de webhooks do Asaas (evita processar o mesmo evento duas vezes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_event (
  id TEXT PRIMARY KEY,           -- id do evento enviado pelo Asaas
  event TEXT NOT NULL,
  payment_id TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. Segurança das tabelas novas: leitura/escrita só pelo servidor (service role),
--    exceto avaliações e o resumo de notas, que são públicos.
-- -----------------------------------------------------------------------------
ALTER TABLE match_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read ratings" ON rating;
CREATE POLICY "Public can read ratings" ON rating FOR SELECT USING (true);
GRANT SELECT ON team_rating_summary TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. Aviso automático 2h após o fim do jogo (placar + avaliação)
--     Requer a extensão pg_cron: Supabase > Database > Extensions > pg_cron.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_post_match()
RETURNS INTEGER AS $$
DECLARE
  r RECORD;
  v_first UUID;
  v_owner UUID;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT ms.*
    FROM match_slot ms
    WHERE ms.status = 'confirmed'
      AND ms.post_match_notified_at IS NULL
      AND ((ms.date + ms.time) AT TIME ZONE 'America/Sao_Paulo')
          + make_interval(mins => COALESCE(ms.duration_minutes, 60) + 120) <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT owner_id INTO v_owner FROM field WHERE id = r.field_id;
    IF r.has_local_team IS TRUE AND r.home_team_type IN ('LOCAL', 'MENSALISTA') THEN
      v_first := COALESCE(r.home_team_user_id, v_owner);
    ELSE
      v_first := r.booked_by_user_id;
    END IF;

    IF v_first IS NOT NULL THEN
      INSERT INTO notification (user_id, title, description, type) VALUES (
        v_first, 'Como foi o jogo? 🏆',
        'Lance o placar do jogo de ' || to_char(r.date, 'DD/MM') || ' e avalie o adversário e o campo.', 'info');
    END IF;
    IF r.opponent_user_id IS NOT NULL AND r.opponent_user_id IS DISTINCT FROM v_first THEN
      INSERT INTO notification (user_id, title, description, type) VALUES (
        r.opponent_user_id, 'Avalie sua partida ⭐',
        'Conte como foi o jogo de ' || to_char(r.date, 'DD/MM') || ': avalie o adversário e o campo.', 'info');
    END IF;

    UPDATE match_slot SET post_match_notified_at = NOW() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agenda a cada 15 minutos (só funciona se o pg_cron estiver habilitado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'jogo-facil-post-match';
    PERFORM cron.schedule('jogo-facil-post-match', '*/15 * * * *', 'SELECT notify_post_match();');
  ELSE
    RAISE NOTICE 'pg_cron não habilitado: habilite a extensão e rode este bloco de novo para agendar notify_post_match().';
  END IF;
END $$;
