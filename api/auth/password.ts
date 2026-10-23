import { handle, json, readJson, assert, HttpError } from '../_lib/http.js';
import { requireSession, loadUser } from '../_lib/auth.js';
import { checkPassword, setUserPassword, validateNewPassword } from '../_lib/passwords.js';

/**
 * Troca de senha com sessão.
 *
 * POST /api/auth/password
 *  - { action: 'change', currentPassword, newPassword }  o próprio usuário, confirmando a senha atual
 *  - { action: 'admin_set', userId, newPassword }         só o SUPER_ADMIN, para outra conta
 */

export const POST = handle(async request => {
  const body = await readJson(request);
  // Sem actAsUserId: a troca vale sempre para quem está logado (ou, no admin_set, para o userId informado)
  const { actor } = await requireSession(request);
  const newPassword = validateNewPassword(body.newPassword);

  switch (body.action) {
    case 'change': {
      // Admin "acessando" outra conta: não troca a própria senha por engano
      if (body.actAsUserId && body.actAsUserId !== actor.id) {
        throw new HttpError(400, 'Para trocar a senha de outra conta, use a opção do administrador.');
      }
      const ok = await checkPassword(actor.email, String(body.currentPassword || ''));
      if (!ok) throw new HttpError(400, 'Senha atual incorreta.', 'WRONG_PASSWORD');
      await setUserPassword(actor.id, newPassword);
      return json({ message: 'Senha alterada!' });
    }

    case 'admin_set': {
      assert(actor.role === 'SUPER_ADMIN', 403, 'Somente o administrador geral pode trocar a senha de outra conta.');
      const target = await loadUser(String(body.userId || ''));
      assert(target, 404, 'Conta não encontrada.');
      await setUserPassword(target.id, newPassword);
      return json({ message: 'Senha alterada!' });
    }

    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
