/**
 * Contato de suporte (WhatsApp): recuperar senha.
 * Configure SUPPORT_WHATSAPP (ou VITE_SUPPORT_WHATSAPP) na Vercel com DDI + DDD + número,
 * só dígitos (ex.: 5511999999999). O valor entra no app no build (ver vite.config.ts).
 */
declare const __SUPPORT_WHATSAPP__: string | undefined;

export const SUPPORT_WHATSAPP = (
  (typeof __SUPPORT_WHATSAPP__ !== 'undefined' ? __SUPPORT_WHATSAPP__ : '') ||
  (import.meta as any).env?.VITE_SUPPORT_WHATSAPP ||
  ''
).replace(/\D/g, '');

const openSupport = (url: string) => {
  if (!SUPPORT_WHATSAPP) {
    alert('WhatsApp de suporte não configurado. Defina SUPPORT_WHATSAPP na Vercel.');
    return;
  }
  window.open(url, '_blank');
};

/** Recuperação de senha pelo suporte (enquanto o envio de e-mail não estiver configurado). */
export const openPasswordHelpWhatsApp = (email: string) => {
  const message = `Olá, esqueci minha senha do Jogo Facil. Meu e-mail de cadastro é ${email || '(informe seu e-mail)'}. Pode me ajudar a criar uma nova?`;
  openSupport(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`);
};
