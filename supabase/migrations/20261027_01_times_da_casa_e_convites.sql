-- =============================================================================
-- JOGO FÁCIL - Passo 4: times da casa, mensalistas por convite e mandante no horário
--
-- Pode rodar antes ou junto com o deploy da versão nova.
--
-- - registered_team passa a guardar os dois tipos de time do campo:
--     kind = 'MENSALISTA' (dia/horário/quadra fixos) ou 'LOCAL' (time da casa).
--   captain_user_id = conta do dono do time (vazio enquanto ninguém aceitou o convite).
-- - team_invite: links de convite (só o servidor lê e grava).
-- - match_slot.home_team_id: qual time da casa/mensalista é o mandante do horário.
-- =============================================================================

ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'MENSALISTA';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registered_team_kind_check') THEN
    ALTER TABLE registered_team ADD CONSTRAINT registered_team_kind_check CHECK (kind IN ('MENSALISTA', 'LOCAL'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_registered_team_field ON registered_team(field_id);
CREATE INDEX IF NOT EXISTS idx_registered_team_captain ON registered_team(captain_user_id);

-- Convites (token secreto): sem acesso pelo navegador
CREATE TABLE IF NOT EXISTS team_invite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  team_id UUID NOT NULL REFERENCES registered_team(id) ON DELETE CASCADE,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_team_invite_team ON team_invite(team_id);
ALTER TABLE team_invite ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON team_invite FROM anon, authenticated;

-- Mandante do horário
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS home_team_id UUID REFERENCES registered_team(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_match_slot_home_team ON match_slot(home_team_id);
-- O dono do campo escolhe o mandante ao criar/editar o horário pelo app
GRANT UPDATE (home_team_id) ON match_slot TO anon, authenticated;

-- Descobre a conta dona do mandante.
-- Com home_team_id: dono do time (se ninguém aceitou o convite ainda e for time da casa, o dono do campo).
-- Sem home_team_id (horários antigos): mesma regra de antes (nome/telefone do mensalista).
CREATE OR REPLACE FUNCTION match_slot_resolve_home_team()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
  v_user UUID;
  v_role TEXT;
BEGIN
  IF NEW.has_local_team IS TRUE AND NEW.home_team_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.home_team_id IS DISTINCT FROM OLD.home_team_id OR NEW.home_team_user_id IS NULL) THEN
    SELECT captain_user_id INTO v_user FROM registered_team WHERE id = NEW.home_team_id;
    IF v_user IS NULL AND NEW.home_team_type = 'LOCAL' THEN
      SELECT owner_id INTO v_user FROM field WHERE id = NEW.field_id;
    END IF;
    NEW.home_team_user_id := v_user;
  ELSIF NEW.has_local_team IS TRUE AND NEW.home_team_user_id IS NULL THEN
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

  -- Aviso quando o dono do campo cria pelo app um horário para o time.
  -- Inserções do servidor (service_role) não avisam aqui: o servidor manda um aviso único.
  -- (Em função SECURITY DEFINER o current_user é o dono da função, então o papel vem do JWT.)
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json->>'role',
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
  IF TG_OP = 'INSERT' AND NEW.has_local_team IS TRUE AND NEW.home_team_user_id IS NOT NULL
     AND v_role IN ('anon', 'authenticated') THEN
    SELECT owner_id INTO v_owner FROM field WHERE id = NEW.field_id;
    IF NEW.home_team_user_id IS DISTINCT FROM v_owner THEN
      INSERT INTO notification (user_id, title, description, type)
      VALUES (
        NEW.home_team_user_id,
        'Novo jogo na sua agenda 📅',
        'A arena criou um horário para o seu time em ' || to_char(NEW.date, 'DD/MM') || ' às ' || to_char(NEW.time, 'HH24:MI') ||
        '. Envie o convite para um adversário!',
        'info'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_match_slot_resolve_home_team ON match_slot;
CREATE TRIGGER trg_match_slot_resolve_home_team
BEFORE INSERT OR UPDATE OF has_local_team, home_team_type, local_team_name, local_team_phone, home_team_id ON match_slot
FOR EACH ROW EXECUTE FUNCTION match_slot_resolve_home_team();
