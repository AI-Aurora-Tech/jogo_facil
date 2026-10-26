/** Validação de CPF e CNPJ (dígitos verificadores). Sem dependências: usado no app e no servidor. */

export const onlyDigits = (v: string | null | undefined) => (v || '').replace(/\D/g, '');

const allSame = (d: string) => /^(\d)\1+$/.test(d);

export const isValidCpf = (value: string): boolean => {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSame(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
};

export const isValidCnpj = (value: string): boolean => {
  const d = onlyDigits(value);
  if (d.length !== 14 || allSame(d)) return false;
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
};

export const isValidCpfCnpj = (value: string): boolean => isValidCpf(value) || isValidCnpj(value);

/** 12345678909 -> 123.456.789-09 ; 14 dígitos -> 12.345.678/0001-95 (formata enquanto digita). */
export const formatCpfCnpj = (value: string): string => {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};
