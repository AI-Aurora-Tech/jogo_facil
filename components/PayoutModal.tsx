import React, { useEffect, useState } from 'react';
import { X, Wallet, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { Button } from './Button';
import { Field, User } from '../types';
import { api } from '../api';
import { openPaymentSetupWhatsApp } from '../support';

interface PayoutModalProps {
  field: Field;
  currentUser: User;
  /** Admin geral acessando a conta do dono do campo: pode informar o Wallet ID. */
  isAdminView?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Conta de recebimento do dono do campo (split automático do Asaas).
 * A configuração é feita com ajuda do suporte (WhatsApp); o admin geral salva o Wallet ID.
 */
export const PayoutModal: React.FC<PayoutModalProps> = ({ field, currentUser, isAdminView, onClose, onSaved }) => {
  const [status, setStatus] = useState<{ hasWallet: boolean; walletIdEnd?: string | null; platformFeePercent?: number } | null>(null);
  const [walletId, setWalletId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.payouts('status', field.id).then(setStatus).catch(e => setError(e.message));
  }, [field.id]);

  const saveWallet = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.payouts('set_wallet', field.id, { walletId });
      alert(res.message || 'Conta de recebimento salva!');
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-pitch/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 max-h-[92vh] overflow-y-auto pb-safe">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-black text-pitch uppercase italic flex items-center gap-2"><Wallet className="w-5 h-5" /> Recebimentos</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">As taxas dos jogos caem direto na sua conta</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        {!status && !error && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}

        {status?.hasWallet && (
          <div className="bg-grass-50 border border-grass-200 p-6 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-grass-600 mx-auto" />
            <p className="font-black text-pitch uppercase text-sm">Conta de recebimento ativa</p>
            <p className="text-[10px] font-bold text-gray-500">Carteira ...{status.walletIdEnd}</p>
          </div>
        )}

        {status && !status.hasWallet && (
          <div className="space-y-4">
            <p className="text-xs font-bold text-gray-500">
              Fale com a gente pelo WhatsApp: ajudamos você a configurar a conta para receber os pagamentos dos jogos.
            </p>
            <Button onClick={() => openPaymentSetupWhatsApp(currentUser.name)} className="w-full py-4 rounded-2xl font-black uppercase text-xs">
              <MessageCircle className="w-4 h-4" /> Configurar pagamento
            </Button>
          </div>
        )}

        {isAdminView && status && (
          <div className="mt-6 pt-6 border-t space-y-2">
            <p className="text-[10px] font-black text-gray-400 uppercase">Admin: Wallet ID do Asaas do dono do campo</p>
            <input
              className="w-full p-3 bg-gray-50 rounded-xl border font-bold text-xs outline-none"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={walletId}
              onChange={e => setWalletId(e.target.value)}
            />
            <Button onClick={saveWallet} isLoading={saving} disabled={!walletId} variant="outline" className="w-full py-3 rounded-2xl font-black uppercase text-xs">
              Salvar carteira
            </Button>
          </div>
        )}

        {error && <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold">{error}</div>}
      </div>
    </div>
  );
};
