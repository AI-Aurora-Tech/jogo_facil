/** Utilitários HTTP das funções da Vercel (formato Web Request/Response). */

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const readJson = async <T = any>(request: Request): Promise<T> => {
  try {
    const text = await request.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }
};

/** Envolve o handler para transformar erros em respostas JSON padronizadas. */
export const handle = (fn: (request: Request) => Promise<Response>) => async (request: Request): Promise<Response> => {
  try {
    return await fn(request);
  } catch (err: any) {
    if (err instanceof HttpError) {
      return json({ error: err.message, code: err.code }, err.status);
    }
    console.error('[api] erro inesperado', err);
    return json({ error: 'Erro interno. Tente novamente em instantes.' }, 500);
  }
};

export const assert: (cond: unknown, status: number, message: string, code?: string) => asserts cond = (cond, status, message, code) => {
  if (!cond) throw new HttpError(status, message, code);
};
