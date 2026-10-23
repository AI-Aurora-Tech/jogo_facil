import { api } from '../api';

/**
 * Gera o link de convite da partida e abre o compartilhamento do celular
 * (ou o WhatsApp, quando o navegador não tem compartilhamento nativo).
 */
export const shareInvite = async (slotId: string): Promise<void> => {
  try {
    const { url, message } = await api.createInvite(slotId);
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Convite Jogo Fácil', text: message });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // usuário fechou o compartilhamento
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* sem permissão de área de transferência */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  } catch (e: any) {
    alert(e.message || 'Não foi possível gerar o convite.');
  }
};
