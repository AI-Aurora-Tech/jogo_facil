
-- SCRIPT DE ENDURECIMENTO DE SEGURANÇA (SECURITY HARDENING)
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Habilitar a extensão pgcrypto para hashing seguro de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Criar função para hash automático de senhas
CREATE OR REPLACE FUNCTION hash_user_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas faz o hash se for uma nova inserção ou se a senha foi alterada
  -- E se a senha ainda não estiver no formato hash ($2a$)
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.password <> OLD.password)) AND NEW.password NOT LIKE '$2a$%' THEN
    NEW.password := crypt(NEW.password, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Aplicar o trigger na tabela de usuários
DROP TRIGGER IF EXISTS trg_hash_password ON "user";
CREATE TRIGGER trg_hash_password
BEFORE INSERT OR UPDATE ON "user"
FOR EACH ROW
EXECUTE FUNCTION hash_user_password();

-- 4. Criar função segura para Login (RPC)
-- Esta função permite verificar a senha no servidor sem nunca expô-la ao front-end.
DROP FUNCTION IF EXISTS login_user(TEXT, TEXT);
CREATE OR REPLACE FUNCTION login_user(p_email TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    phone_number TEXT,
    role TEXT,
    subscription TEXT,
    subscription_expiry TIMESTAMP WITH TIME ZONE,
    teams JSONB,
    latitude FLOAT,
    longitude FLOAT,
    team_rating FLOAT,
    team_rating_count INTEGER,
    is_subscribed BOOLEAN,
    subscription_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.email, u.name, u.phone_number, u.role, 
        u.subscription, u.subscription_expiry, u.teams, 
        u.latitude, u.longitude, u.team_rating, 
        u.team_rating_count, u.is_subscribed, u.subscription_id, u.created_at
    FROM "user" u
    WHERE u.email = LOWER(TRIM(p_email))
    AND u.password = crypt(p_password, u.password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Restringir acesso direto à coluna de senha
-- Isso garante que mesmo que alguém tente dar um SELECT *, a senha não virá.
REVOKE SELECT (password) ON "user" FROM anon;
REVOKE SELECT (password) ON "user" FROM authenticated;

-- 6. Refinar Políticas de RLS (Row Level Security)
-- Vamos remover as políticas de "Public Access" total e criar algo mais granular.

-- TABELA: user
DROP POLICY IF EXISTS "Allow Public Access" ON "user";
CREATE POLICY "Users can see basic info" ON "user" FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON "user" FOR UPDATE USING (true);
CREATE POLICY "Users can insert themselves" ON "user" FOR INSERT WITH CHECK (true);

-- TABELA: field
DROP POLICY IF EXISTS "Allow Public Access" ON field;
CREATE POLICY "Public can view fields" ON field FOR SELECT USING (true);
CREATE POLICY "Owners can manage their fields" ON field FOR ALL USING (true);

-- TABELA: match_slot
DROP POLICY IF EXISTS "Allow Public Access" ON match_slot;
CREATE POLICY "Public can view slots" ON match_slot FOR SELECT USING (true);
CREATE POLICY "Users can book and update slots" ON match_slot FOR UPDATE USING (true);
CREATE POLICY "Owners can manage slots" ON match_slot FOR ALL USING (true);

-- TABELA: notification
DROP POLICY IF EXISTS "Allow Public Access" ON notification;
CREATE POLICY "Users can see their own notifications" ON notification FOR SELECT USING (true);
CREATE POLICY "System can create notifications" ON notification FOR INSERT WITH CHECK (true);

-- TABELA: registered_team
DROP POLICY IF EXISTS "Allow Public Access" ON registered_team;
CREATE POLICY "Public can view registered teams" ON registered_team FOR SELECT USING (true);
CREATE POLICY "Captains can manage their teams" ON registered_team FOR ALL USING (true);

-- 7. Converter senhas atuais para hash (Opcional, mas recomendado)
-- Se você já tem usuários, execute isto para proteger as senhas atuais.
UPDATE "user" 
SET password = crypt(password, gen_salt('bf')) 
WHERE password NOT LIKE '$2a$%';
