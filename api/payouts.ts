import { handle, json, readJson, assert, HttpError } from './_lib/http.js';
import { requireSession, isAdmin } from './_lib/auth.js';
import { db } from './_lib/supabaseAdmin.js';
import { asaas } from './_lib/asaas.js';
import { env } from './_lib/env.js';

/**
 * Conta de recebimento (para o split automático das taxas).
 * - Dono do campo (com fieldId): recebe a taxa dos horários livres do campo.
 * - Dono de time (sem fieldId): recebe a taxa dos jogos em que o time dele é mandante.
 *
 * POST /api/payouts { action: 'status' | 'set_wallet' | 'create_account', fieldId?, ... }
 *  - set_wallet:     quem já tem conta Asaas informa o Wallet ID (Asaas > Minha conta > Integrações)
 *  - create_account: cria uma subconta Asaas para o dono do campo, sem ele sair do app
 */

const WALLET_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = handle(async request => {
  const body = await readJson(request);
  const { user, actor } = await requireSession(request, body.actAsUserId);

  // Sem fieldId: conta de recebimento do próprio dono de time (taxa dos jogos em que ele é mandante)
  let target: { table: 'field' | 'user'; id: string; wallet: string | null; status: string | null };
  if (body.fieldId) {
    const { data: field, error } = await db().from('field').select('*').eq('id', body.fieldId).maybeSingle();
    if (error) throw error;
    assert(field, 404, 'Campo não encontrado.');
    assert(field.owner_id === user.id || isAdmin(actor), 403, 'Somente o dono do campo pode configurar recebimentos.');
    target = { table: 'field', id: field.id, wallet: field.asaas_wallet_id, status: field.payout_status };
  } else {
    assert(user.role === 'TEAM_CAPTAIN', 400, 'Informe o campo.');
    const { data: u, error } = await db().from('user').select('id, asaas_wallet_id, payout_status').eq('id', user.id).maybeSingle();
    if (error) throw error;
    target = { table: 'user', id: user.id, wallet: u?.asaas_wallet_id || null, status: u?.payout_status || null };
  }

  switch (body.action) {
    case 'status':
      return json({
        payoutStatus: target.status || 'NONE',
        hasWallet: !!target.wallet,
        walletIdEnd: target.wallet ? String(target.wallet).slice(-6) : null,
        platformFeePercent: env.platformFeePercent(),
      });

    case 'set_wallet': {
      const walletId = String(body.walletId || '').trim();
      assert(WALLET_RE.test(walletId), 400, 'Wallet ID inválido. Ele tem o formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.');
      const { error: upErr } = await db().from(target.table).update({ asaas_wallet_id: walletId, payout_status: 'ACTIVE' }).eq('id', target.id);
      if (upErr) throw upErr;
      return json({ payoutStatus: 'ACTIVE', hasWallet: true, message: 'Conta de recebimento salva!' });
    }

    case 'create_account': {
      assert(target.table === 'field', 400, 'Para times, informe o Wallet ID da sua conta Asaas.');
      assert(!target.wallet, 400, 'Este campo já tem conta de recebimento.');
      const required = ['cpfCnpj', 'mobilePhone', 'incomeValue', 'address', 'addressNumber', 'province', 'postalCode'];
      for (const key of required) assert(body[key], 400, 'Preencha todos os dados para criar a conta.');
      const doc = String(body.cpfCnpj).replace(/\D/g, '');
      assert(doc.length === 11 || doc.length === 14, 400, 'CPF ou CNPJ inválido.');
      if (doc.length === 11) assert(body.birthDate, 400, 'Informe a data de nascimento.');
      if (doc.length === 14) assert(body.companyType, 400, 'Informe o tipo de empresa.');

      const account = await asaas.createSubaccount({
        name: String(body.name || user.name),
        email: String(body.email || user.email),
        cpfCnpj: doc,
        birthDate: doc.length === 11 ? String(body.birthDate) : undefined,
        companyType: doc.length === 14 ? String(body.companyType) : undefined,
        mobilePhone: String(body.mobilePhone),
        incomeValue: Number(body.incomeValue),
        address: String(body.address),
        addressNumber: String(body.addressNumber),
        province: String(body.province),
        postalCode: String(body.postalCode),
      });
      if (!account.walletId) throw new HttpError(502, 'O Asaas não retornou a carteira. Tente novamente.');
      await db().from('field').update({ asaas_wallet_id: account.walletId, asaas_account_id: account.id, payout_status: 'ACTIVE' }).eq('id', target.id);
      return json({
        payoutStatus: 'ACTIVE',
        hasWallet: true,
        message: 'Conta criada! O Asaas vai enviar um e-mail para você definir a senha e enviar os documentos. Os valores dos jogos caem nessa conta.',
      });
    }

    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
