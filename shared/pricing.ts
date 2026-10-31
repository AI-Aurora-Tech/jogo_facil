/**
 * Regras de cobrança da mensalidade dos donos de time.
 *
 * - Donos de campo: grátis.
 * - Donos de time: a 1ª categoria é grátis para todos; cada categoria adicional custa R$ 19,99 por mês.
 *
 * Arquivo sem dependências: é usado pelo app (navegador) e pelas funções da Vercel.
 */

export const CATEGORY_MONTHLY_PRICE = 19.99;

/** Quantidade de categorias que ficam grátis quando o time tem apenas essa quantidade. */
export const FREE_CATEGORY_LIMIT = 1;

/**
 * Quando o time passa do limite grátis, a 1ª categoria também é cobrada?
 * true  -> 2 categorias = 2 x 19,99 = R$ 39,98
 * false -> 2 categorias = 1 x 19,99 = R$ 19,99 (a 1ª continua grátis)
 */
export const CHARGE_ALL_CATEGORIES_WHEN_PAYING = false;

export interface TeamLike {
  name?: string;
  categories?: string[];
}

/** Conta categorias distintas por time (Time A Sub-11 e Time B Sub-11 contam 2). */
export const countBillableCategories = (teams: TeamLike[] | null | undefined): number => {
  const keys = new Set<string>();
  for (const team of teams || []) {
    const teamKey = (team.name || '').trim().toLowerCase();
    for (const cat of team.categories || []) {
      const catKey = (cat || '').trim().toLowerCase();
      if (catKey) keys.add(`${teamKey}::${catKey}`);
    }
  }
  return keys.size;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const monthlyPriceForCategories = (count: number): number => {
  if (count <= FREE_CATEGORY_LIMIT) return 0;
  const charged = CHARGE_ALL_CATEGORIES_WHEN_PAYING ? count : count - FREE_CATEGORY_LIMIT;
  return roundMoney(charged * CATEGORY_MONTHLY_PRICE);
};

export const monthlyPriceForTeams = (teams: TeamLike[] | null | undefined): number =>
  monthlyPriceForCategories(countBillableCategories(teams));

export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
