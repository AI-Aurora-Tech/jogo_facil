-- =============================================================================
-- JOGO FÁCIL - Passo 6: agenda do time, link exclusivo e visitantes
--
-- Pode rodar antes do deploy.
--
-- - Conta de recebimento do dono de time (a taxa dos jogos em casa vai para o mandante).
-- - team_page: link exclusivo da agenda de cada time.
-- - team_availability: dias/horários em que o time quer jogar FORA (visitante).
-- - away_invite: convite de um mandante para um visitante disponível.
-- - match_slot.custom_location: jogo em casa num local próprio (campo sem cadastro no app).
-- Tabelas novas: só o servidor lê e grava.
-- =============================================================================

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS payout_status TEXT;

ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS custom_location TEXT;
ALTER TABLE match_slot ALTER COLUMN field_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS team_page (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_page_team ON team_page (user_id, LOWER(team_name));

CREATE TABLE IF NOT EXISTS team_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  category TEXT NOT NULL,
  gender TEXT,
  sport TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_availability_date ON team_availability (date);
CREATE INDEX IF NOT EXISTS idx_team_availability_user ON team_availability (user_id);

CREATE TABLE IF NOT EXISTS away_invite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES match_slot(id) ON DELETE CASCADE,
  availability_id UUID REFERENCES team_availability(id) ON DELETE SET NULL,
  from_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  to_team_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_away_invite_to ON away_invite (to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_away_invite_slot ON away_invite (slot_id);
-- Um convite aberto por visitante por jogo
CREATE UNIQUE INDEX IF NOT EXISTS idx_away_invite_open ON away_invite (slot_id, to_user_id) WHERE status = 'pending';

ALTER TABLE team_page ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE away_invite ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON team_page, team_availability, away_invite FROM anon, authenticated;
