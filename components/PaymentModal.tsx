import React, { useCallback, useEffect, useState } from 'react';
import { X, Copy, Check, ExternalLink, Loader2, RefreshCw, QrCode } from 'lucide-react';
import { Button } from './Button';
import { MatchSlot, MatchPaymentInfo } from '../types';
import { api, ServerError } from '../api';
import { formatBRL } from '../shared/money';

interface PaymentModalProps {
  slot: MatchSlot;
  fieldName?: string;
  onClose: () => void;
  onPaid: () => void;
}

/** PIX da taxa do jogo (gerado pelo Asaas, com repasse automático para o campo). */
export const PaymentModal: React.FC<PaymentModalProps> = ({ slot, fieldName, onClose, onPaid }) => {
  const [payment, setPayment] = useState<MatchPaymentInfo | null>(null);
  const [error, setError] = useState('');
  const [needsCpf, setNeedsCpf] = useState(false);
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (cpfCnpj?: string) => {
    setLoading(true);
    setError('');
    try {
      const { payment } = await api.payMatch(slot.id, cpfCnpj);
      setPayment(payment);
      setNeedsCpf(false);
      if (payment.status === 'PAID') onPaid();
    } catch (e: any) {
      if (e instanceof ServerError && e.code === 'NEED_CPF') setNeedsCpf(true);
      setError(e.message || 'Não foi possível gerar o PIX.');
    } finally {
      setLoading(false);
    }
  }, [slot.id, onPaid]);

  useEffect(() => { load(); }, [load]);

  const checkPayment = async () => {
    setChecking(true);
    try {
      const { payments } = await api.matchPayments(slot.id);
      const mine = payments.find(p => p.id === payment?.id);
      if (mine?.status === 'PAID') {
        alert('Pagamento confirmado! ✅');
        onPaid();
      } else {
        alert('Ainda não recebemos o PIX. Se já pagou, aguarde alguns segundos e tente de novo.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setChecking(false);
    }
  };

  const copyCode = async () => {
    if (!payment?.pixPayload) return;
    await navigator.clipboard.writeText(payment.pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-pitch/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 max-h-[92vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">Pagamento via PIX</span>
            <h3 className="text-xl font-black text-pitch uppercase italic mt-2">Taxa do jogo</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase">
              {fieldName ? `${fieldName} • ` : ''}{slot.date.split('-').reverse().join('/')} às {slot.time}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        {loading && (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-[10px] font-black uppercase">Gerando PIX...</span>
          </div>
        )}

        {!loading && needsCpf && (
          <div className="space-y-4">
            <p className="text-xs font-bold text-gray-500">Para gerar o PIX precisamos do CPF (ou CNPJ) do responsável pelo pagamento. Pedimos só uma vez.</p>
            <input
              inputMode="numeric"
              className="w-full p-4 bg-gray-50 rounded-2xl border font-black text-pitch outline-none"
              placeholder="CPF ou CNPJ"
              value={cpf}
              onChange={e => setCpf(e.target.value)}
            />
            <Button onClick={() => load(cpf)} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Gerar PIX</Button>
          </div>
        )}

        {!loading && error && !needsCpf && (
          <div className="space-y-4">
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold">{error}</div>
            <Button onClick={() => load()} variant="outline" className="w-full py-3 rounded-2xl text-xs font-black uppercase"><RefreshCw className="w-4 h-4" /> Tentar de novo</Button>
          </div>
        )}

        {!loading && payment && payment.status === 'PAID' && (
          <div className="bg-grass-50 border border-grass-200 p-6 rounded-2xl text-center">
            <Check className="w-10 h-10 text-grass-600 mx-auto mb-2" />
            <p className="font-black text-pitch uppercase text-sm">Pagamento confirmado</p>
            <p className="text-[10px] font-bold text-gray-500 mt-1">{formatBRL(payment.amount)}</p>
          </div>
        )}

        {!loading && payment && payment.status !== 'PAID' && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase">Valor do seu time</p>
              <p className="text-3xl font-black text-pitch">{formatBRL(payment.amount)}</p>
            </div>

            {payment.pixQrBase64 ? (
              <img src={`data:image/png;base64,${payment.pixQrBase64}`} alt="QR Code PIX" className="w-56 h-56 mx-auto rounded-2xl border" />
            ) : (
              <div className="w-56 h-56 mx-auto rounded-2xl border flex items-center justify-center text-gray-300"><QrCode className="w-16 h-16" /></div>
            )}

            {payment.pixPayload && (
              <button onClick={copyCode} className="w-full p-4 bg-gray-50 rounded-2xl border flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
                <span className="flex-1 text-[10px] font-mono text-gray-500 break-all line-clamp-2">{payment.pixPayload}</span>
                {copied ? <Check className="w-5 h-5 text-grass-600 flex-shrink-0" /> : <Copy className="w-5 h-5 text-pitch flex-shrink-0" />}
              </button>
            )}
            <p className="text-[9px] font-bold text-gray-400 uppercase text-center">PIX copia e cola • o valor vai direto para o mandante do jogo (ou para a arena, em horário livre)</p>

            <Button onClick={checkPayment} isLoading={checking} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Já paguei</Button>
            {payment.invoiceUrl && (
              <a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="w-full py-3 rounded-2xl border text-[10px] font-black uppercase text-gray-500 flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> Abrir fatura
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
