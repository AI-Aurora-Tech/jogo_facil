import React, { useEffect, useState } from 'react';
import { ShieldCheck, LogOut, ExternalLink, Loader2, ChevronLeft, Pencil, Gift } from 'lucide-react';
import { User } from '../types';
import { api, ServerError } from '../api';
import { MONTHLY_PRICE, TRIAL_DAYS, formatBRL, isTrialActive, trialDaysLeft } from '../shared/pricing';

interface SubscriptionProps {
  user: User;
  /** true quando o app está bloqueado até regularizar (não mostra "voltar"). */
  blocking: boolean;
  onBack?: () => void;
  onLogout?: () => void;
  onEditCategories?: () => void;
  onUserUpdated?: (u: User) => void;
}

/**
 * Mensalidade do dono de time: 30 dias grátis e depois R$ 19,99 por mês,
 * qualquer que seja a quantidade de times e categorias.
 * A cobrança é uma assinatura recorrente no Asaas (PIX, boleto ou cartão).
 */
export const Subscription: React.FC<SubscriptionProps> = ({ user, blocking, onBack, onLogout, onEditCategories, onUserUpdated }) => {
  const inTrial = isTrialActive(user.trialEndsAt);
  const initialStatus = user.billingStatus === 'ACTIVE' ? 'ACTIVE' : inTrial ? 'TRIAL' : !user.billingStatus || user.billingStatus === 'FREE' ? 'PENDING' : user.billingStatus;
  const [status, setStatus] = useState<string>(initialStatus);
  const [daysLeft, setDaysLeft] = useState(trialDaysLeft(user.trialEndsAt));
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [needsCpf, setNeedsCpf] = useState(false);
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.billing('status')
      .then(res => {
        setStatus(res.billingStatus);
        setInvoiceUrl(res.invoiceUrl || null);
        if (typeof res.trialDaysLeft === 'number') setDaysLeft(res.trialDaysLeft);
        // Libera o app se o servidor diz que ainda está no teste ou com a mensalidade ativa
        if ((res.billingStatus === 'TRIAL' || res.billingStatus === 'ACTIVE') && (res.trialEndsAt !== user.trialEndsAt || (res.billingStatus === 'ACTIVE' && user.billingStatus !== 'ACTIVE'))) {
          onUserUpdated?.({
            ...user,
            trialEndsAt: res.trialEndsAt || user.trialEndsAt,
            billingStatus: res.billingStatus === 'ACTIVE' ? 'ACTIVE' : user.billingStatus,
          });
        }
      })
      .catch(() => { /* sem servidor: mantém o que já sabemos */ });
  }, []);

  const subscribe = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.billing('subscribe', needsCpf ? { cpfCnpj: cpf } : {});
      setStatus(res.billingStatus);
      setNeedsCpf(false);
      if (res.invoiceUrl) {
        setInvoiceUrl(res.invoiceUrl);
        window.open(res.invoiceUrl, '_blank');
      } else if (res.billingStatus === 'TRIAL') {
        alert('Assinatura criada! A 1ª cobrança é no fim do seu teste grátis.');
      }
    } catch (e: any) {
      if (e instanceof ServerError && e.code === 'NEED_CPF') setNeedsCpf(true);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const updated = await api.getUserById(user.id);
      onUserUpdated?.(updated);
      setStatus(updated.billingStatus === 'ACTIVE' ? 'ACTIVE' : status);
      if (updated.billingStatus === 'ACTIVE') alert('Mensalidade ativa! ✅');
      else alert('Ainda não identificamos o pagamento. Pode levar alguns minutos.');
    } finally {
      setLoading(false);
    }
  };

  const statusText =
    status === 'ACTIVE' ? 'Mensalidade ativa'
      : status === 'TRIAL' ? `Teste grátis: ${daysLeft} dia(s) restante(s)`
        : status === 'OVERDUE' ? 'Mensalidade em atraso'
          : 'Teste grátis encerrado';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      {!blocking && onBack && (
        <button onClick={onBack} className="self-start mb-4 p-3 bg-white rounded-full shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
      )}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-pitch italic uppercase tracking-tighter">Sua mensalidade</h1>
        <p className="text-gray-500 mt-2 text-sm">
          {TRIAL_DAYS} dias grátis. Depois, {formatBRL(MONTHLY_PRICE)} por mês com quantas categorias quiser.
        </p>
      </div>

      <div className="w-full max-w-sm bg-pitch rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 text-white space-y-6">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-grass-500 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase text-grass-500">{statusText}</p>
              {blocking && <p className="text-[10px] font-bold text-gray-300 uppercase mt-1">Assine para continuar marcando jogos.</p>}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 flex justify-between items-center">
            <span className="text-sm text-gray-300">Plano dono de time</span>
            <span className="text-3xl font-black">{formatBRL(MONTHLY_PRICE)}</span>
          </div>
          <p className="text-[10px] text-gray-400 uppercase text-right -mt-4">por mês • todos os times e categorias</p>

          {status !== 'ACTIVE' && (
            <>
              {needsCpf && (
                <input
                  inputMode="numeric"
                  className="w-full p-4 rounded-xl text-pitch font-black outline-none"
                  placeholder="CPF ou CNPJ do responsável"
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                />
              )}
              {error && <p className="text-red-300 text-xs font-bold">{error}</p>}
              <button
                onClick={subscribe}
                disabled={loading}
                className="w-full bg-grass-500 hover:bg-grass-600 text-white font-bold uppercase py-4 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {invoiceUrl ? 'Gerar/abrir fatura' : `Assinar por ${formatBRL(MONTHLY_PRICE)}/mês`}
              </button>
              {status === 'TRIAL' && !invoiceUrl && (
                <p className="text-[10px] text-gray-300 text-center">Assinando agora, a 1ª cobrança é só no fim do teste grátis.</p>
              )}
              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="w-full py-3 rounded-xl border border-white/20 text-xs font-black uppercase flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Abrir fatura (PIX, boleto ou cartão)
                </a>
              )}
              <button onClick={refresh} disabled={loading} className="w-full text-[10px] font-black uppercase text-grass-500">Já paguei, atualizar</button>
            </>
          )}

          <p className="text-center text-gray-400 text-xs">Sem fidelidade • Valor fixo, não muda com as categorias</p>
        </div>
      </div>

      {onEditCategories && (
        <button onClick={onEditCategories} className="text-pitch font-black text-xs uppercase mt-6 flex items-center gap-2">
          <Pencil className="w-4 h-4" /> Editar times e categorias
        </button>
      )}
      {onLogout && (
        <button onClick={onLogout} className="text-gray-400 font-bold text-sm mt-6 flex items-center gap-2">
          <LogOut className="w-4 h-4" /> Sair da conta
        </button>
      )}
    </div>
  );
};
