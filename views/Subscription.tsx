import React, { useEffect, useState } from 'react';
import { ShieldCheck, LogOut, Layers, ExternalLink, Loader2, ChevronLeft, Pencil } from 'lucide-react';
import { User } from '../types';
import { api, ServerError } from '../api';
import { countBillableCategories, monthlyPriceForCategories, formatBRL, CATEGORY_MONTHLY_PRICE, FREE_CATEGORY_LIMIT } from '../shared/pricing';

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
 * Mensalidade do dono de time: R$ 19,99 por categoria. Com 1 categoria é grátis.
 * A cobrança é uma assinatura recorrente no Asaas (PIX, boleto ou cartão).
 */
export const Subscription: React.FC<SubscriptionProps> = ({ user, blocking, onBack, onLogout, onEditCategories, onUserUpdated }) => {
  const categories = countBillableCategories(user.teams);
  const value = monthlyPriceForCategories(categories);
  const [status, setStatus] = useState<string>(user.billingStatus || (value === 0 ? 'FREE' : 'PENDING'));
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
      setStatus(updated.billingStatus || status);
      if (updated.billingStatus === 'ACTIVE') alert('Mensalidade ativa! ✅');
      else alert('Ainda não identificamos o pagamento. Pode levar alguns minutos.');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel: Record<string, string> = {
    FREE: 'Grátis',
    ACTIVE: 'Ativa',
    PENDING: 'Aguardando pagamento',
    OVERDUE: 'Em atraso',
    CANCELED: 'Cancelada',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      {!blocking && onBack && (
        <button onClick={onBack} className="self-start mb-4 p-3 bg-white rounded-full shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
      )}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-pitch italic uppercase tracking-tighter">Sua mensalidade</h1>
        <p className="text-gray-500 mt-2 text-sm">
          {formatBRL(CATEGORY_MONTHLY_PRICE)} por categoria. Com {FREE_CATEGORY_LIMIT} categoria é grátis.
        </p>
      </div>

      <div className="w-full max-w-sm bg-pitch rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 text-white space-y-6">
          <div className="space-y-2">
            {(user.teams || []).map(team => (
              <div key={team.name} className="flex justify-between items-start gap-3 text-sm">
                <span className="font-black uppercase">{team.name}</span>
                <span className="text-right text-gray-300 text-xs">{(team.categories || []).join(', ') || '—'}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-4 flex justify-between items-center">
            <span className="flex items-center gap-2 text-sm text-gray-300"><Layers className="w-4 h-4" /> {categories} categoria(s)</span>
            <span className="text-3xl font-black">{value === 0 ? 'Grátis' : formatBRL(value)}</span>
          </div>
          {value > 0 && <p className="text-[10px] text-gray-400 uppercase text-right -mt-4">por mês</p>}

          <div className="bg-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-center">
            Situação: {statusLabel[value === 0 ? 'FREE' : status] || status}
          </div>

          {value > 0 && status !== 'ACTIVE' && (
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
                {invoiceUrl ? 'Gerar/abrir fatura' : `Assinar por ${formatBRL(value)}/mês`}
              </button>
              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="w-full py-3 rounded-xl border border-white/20 text-xs font-black uppercase flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Abrir fatura (PIX, boleto ou cartão)
                </a>
              )}
              <button onClick={refresh} disabled={loading} className="w-full text-[10px] font-black uppercase text-grass-400">Já paguei, atualizar</button>
            </>
          )}

          <p className="text-center text-gray-400 text-xs">Sem fidelidade • O valor muda sozinho quando você adiciona ou remove categorias</p>
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
