-- =============================================================================
-- JOGO FÁCIL - Passo 5: proteção dos times do campo + ajuste do mandante
--
-- Rode depois do 20261027_01_times_da_casa_e_convites.sql e do deploy desta versão
-- (a aprovação de mensalista passou para o servidor).
--
-- 1. O navegador (chave anon) não pode:
--    - definir/trocar o responsável de um time (captain_user_id), mudar o campo (field_id) ou o tipo (kind);
--    - aprovar um time que já tem responsável (status 'approved'/'active').
--    Isso passa a ser feito só pelo servidor (convite aceito, aprovação pelo dono do campo).
--    Sem isso, qualquer pessoa poderia se colocar como time da casa de uma arena e não pagar a taxa.
-- 2. Ao trocar o mandante de um time cadastrado para o time do perfil do dono do campo,
--    o responsável anterior deixa de ser o dono do horário.
-- =============================================================================

CREATE OR REPLACE FUNCTION jf_request_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json->>'role',
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION registered_team_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF jf_request_role() NOT IN ('anon', 'authenticated') THEN
    RETURN NEW; -- servidor (service_role) e SQL Editor podem tudo
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Pedido de mensalista feito pelo time: entra como pendente para o campo aprovar
    IF NEW.captain_user_id IS NOT NULL AND COALESCE(NEW.status, 'pending') <> 'pending' THEN
      RAISE EXCEPTION 'Pedido de time precisa ser aprovado pelo dono do campo.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.captain_user_id IS DISTINCT FROM OLD.captain_user_id THEN
    RAISE EXCEPTION 'O responsável pelo time só muda pelo convite.';
  END IF;
  IF NEW.field_id IS DISTINCT FROM OLD.field_id OR NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'Não é possível mudar o campo ou o tipo do time.';
  END IF;
  IF NEW.captain_user_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'active') THEN
    RAISE EXCEPTION 'A aprovação do time é feita pelo dono do campo no app.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registered_team_guard ON registered_team;
CREATE TRIGGER trg_registered_team_guard
BEFORE INSERT OR UPDATE ON registered_team
FOR EACH ROW EXECUTE FUNCTION registered_team_guard();

-- Mandante: trocar de um time cadastrado para "sem time cadastrado" limpa o dono anterior
CREATE OR REPLACE FUNCTION match_slot_resolve_home_team()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
  v_user UUID;
  v_role TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.home_team_id IS NOT NULL AND NEW.home_team_id IS NULL
     AND NEW.home_team_user_id IS NOT DISTINCT FROM OLD.home_team_user_id THEN
    NEW.home_team_user_id := NULL;
  END IF;

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

  v_role := jf_request_role();
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
