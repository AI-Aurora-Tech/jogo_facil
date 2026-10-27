import { api } from '../api';

/**
 * Convite de time do campo (mensalista ou time da casa).
 * - 'copy': copia o link para o dono do campo colar onde quiser.
 * - 'whatsapp': abre o compartilhamento do celular (ou o WhatsApp) com a mensagem pronta.
 */
export const shareTeamInvite = async (teamId: string, how: 'copy' | 'whatsapp'): Promise<void> => {
  let invite: { url: string; message: string };
  try {
    invite = await api.createTeamInvite(teamId);
  } catch (e: any) {
    alert(e.message || 'Não foi possível gerar o convite.');
    return;
  }

  if (how === 'copy') {
    try {
      await navigator.clipboard.writeText(invite.message);
      alert('Convite copiado! Cole no WhatsApp do time.');
    } catch {
      // Sem acesso à área de transferência: mostra o link para copiar na mão
      prompt('Copie o link do convite:', invite.url);
    }
    return;
  }

  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title: 'Convite Jogo Fácil', text: invite.message });
      return;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(invite.message)}`, '_blank');
};
