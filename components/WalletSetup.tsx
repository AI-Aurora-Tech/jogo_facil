import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, Wallet } from 'lucide-react';
import { Button } from './Button';
import { api } from '../api';
import { openPaymentSetupWhatsApp } from '../support';

const WALLET_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WalletSetupProps {
  /** Campo do dono de campo. Vazio: conta do próprio dono de time (taxa dos jogos em que é mandante). */
  fieldId?: string;
  ownerName: string;
  onSaved?: () => void;
}

/**
 * Dono do campo informa o Wallet ID da conta Asaas dele.
 * As taxas dos jogos pagas pelos times caem direto nessa conta (split do Asaas).
 */
export const WalletSetup: React.FC<WalletSetupProps> = ({ fieldId = '', ownerName, onSaved }) => {
  const [status, setStatus] = useState<{ hasWallet: boolean; walletIdEnd?: string | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [walletId, setWalletId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.payouts('status', fieldId).then(setStatus).catch(e => setError(e.message));
  }, [fieldId]);

  const save = async () => {
    const value = walletId.trim();
    if (!WALLET_RE.test(value)) {
      setError('Wallet ID inválido. Ele tem o formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.payouts('set_wallet', fieldId, { walletId: value });
      setStatus({ hasWallet: true, walletIdEnd: value.slice(-6) });
      setEditing(false);
      setWalletId('');
      alert('Conta de recebimento salva! As taxas dos jogos vão cair direto na sua conta Asaas.');
      onSaved?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const showForm = status && (!status.hasWallet || editing);

  return (
    <div className="space-y-4">
      {status?.hasWallet && !editing && (
        <div className="bg-grass-50 border border-grass-200 p-4 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-grass-600 shrink-0" />
          <div className="flex-1">
            <p className="font-black text-pitch uppercase text-xs">Conta de recebimento ativa</p>
            <p className="text-[10px] font-bold text-gray-500">Carteira Asaas ...{status.walletIdEnd}</p>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="text-[9px] font-black uppercase text-pitch underline">Trocar</button>
        </div>
      )}

      {showForm && (
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-gray-500 space-y-1">
            <p>1. Crie sua conta grátis no Asaas (asaas.com) e cadastre uma chave Pix nela.</p>
            <p>2. No Asaas, abra <b>Integrações → Wallet ID</b> (ou Minha conta) e copie o código.</p>
            <p>3. Cole aqui embaixo. Pronto: as taxas dos jogos caem direto na sua conta.</p>
          </div>
          <div className="bg-white p-3 rounded-xl border flex items-center gap-2">
            <Wallet className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              className="w-full bg-transparent font-bold text-pitch outline-none text-xs"
              placeholder="Wallet ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={walletId}
              onChange={e => setWalletId(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={save} isLoading={saving} disabled={!walletId.trim()} className="flex-1 py-3 rounded-xl font-black uppercase text-[10px]">
              Salvar conta Asaas
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setError(''); }} className="py-3 rounded-xl font-black uppercase text-[10px]">
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold">{error}</div>}

      <button type="button" onClick={() => openPaymentSetupWhatsApp(ownerName)} className="w-full text-[10px] font-black uppercase text-gray-500 flex items-center justify-center gap-2">
        <MessageCircle className="w-4 h-4" /> Precisa de ajuda? Fale com a gente
      </button>
    </div>
  );
};
