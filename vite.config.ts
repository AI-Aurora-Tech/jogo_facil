import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  // O terceiro argumento '' garante que carregue todas as variáveis, não apenas as com prefixo VITE_
  // Fix: Cast process to any because TS might complain about missing cwd() on Process interface in some environments
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // WhatsApp de suporte: aceita SUPPORT_WHATSAPP ou VITE_SUPPORT_WHATSAPP na Vercel
      __SUPPORT_WHATSAPP__: JSON.stringify(env.VITE_SUPPORT_WHATSAPP || env.SUPPORT_WHATSAPP || ''),
      // Evita crash se alguma lib tentar acessar process.env diretamente
      'process.env': {} 
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});