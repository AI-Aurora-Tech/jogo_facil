-- =============================================================================
-- JOGO FÁCIL - Passo 4: app gratuito (sem mensalidade e sem taxa de jogo)
--
-- Rode depois de publicar a versão sem cobrança.
--
-- - Partidas que estavam esperando pagamento (ou comprovante PIX do fluxo antigo)
--   passam a esperar só a aprovação do dono do campo.
-- - As colunas e tabelas antigas de cobrança (match_payment, billing_*, asaas_*,
--   price, pix_key...) ficam no banco, sem uso, para não perder histórico.
--   Nada no app lê ou grava nelas.
-- =============================================================================

UPDATE match_slot
SET status = 'pending_field_approval'
WHERE status IN ('pending_payment', 'pending_verification');

-- Cobranças que ficaram em aberto não valem mais
UPDATE match_payment
SET status = 'CANCELED', updated_at = NOW()
WHERE status IN ('PENDING', 'OVERDUE');
