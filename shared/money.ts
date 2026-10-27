/** Formata valores em reais (taxa do jogo). Sem dependências: usado pelo app e pelo servidor. */
export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
