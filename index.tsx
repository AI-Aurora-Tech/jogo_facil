
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Não foi possível encontrar o elemento root para montar a aplicação.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Erro crítico ao inicializar a aplicação:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; text-align: center;">
        <h2>Erro ao carregar o Jogo Fácil</h2>
        <p>Por favor, recarregue a página ou contate o suporte.</p>
        <pre style="text-align: left; background: #f4f4f4; padding: 10px; font-size: 12px; margin-top: 20px;">${String(error)}</pre>
      </div>
    `;
  }
}
