/**
 * Contato de suporte (WhatsApp) usado para ajudar donos de campo a configurar os recebimentos.
 * Configure VITE_SUPPORT_WHATSAPP na Vercel com DDI + DDD + número, só dígitos (ex.: 5511999999999).
 */
export const SUPPORT_WHATSAPP = ((import.meta as any).env?.VITE_SUPPORT_WHATSAPP || '').replace(/\D/g, '');

export const paymentSetupWhatsAppUrl = (name: string): string => {
  const message = `Olá, me chamo ${name}, e criei conta no Jogo Facil agora, pode me ajudar a configurar a conta para receber meus pagamentos?`;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
};

export const openPaymentSetupWhatsApp = (name: string) => {
  if (!SUPPORT_WHATSAPP) {
    alert('WhatsApp de suporte não configurado. Defina VITE_SUPPORT_WHATSAPP.');
    return;
  }
  window.open(paymentSetupWhatsAppUrl(name), '_blank');
};
