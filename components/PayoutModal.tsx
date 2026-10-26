import React from 'react';
import { X, Wallet } from 'lucide-react';
import { Field, User } from '../types';
import { WalletSetup } from './WalletSetup';

interface PayoutModalProps {
  field: Field;
  currentUser: User;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Conta de recebimento do dono do campo (split automático do Asaas).
 * O próprio dono do campo informa o Wallet ID (também disponível no perfil).
 */
export const PayoutModal: React.FC<PayoutModalProps> = ({ field, currentUser, onClose, onSaved }) => (
  <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-pitch/70 backdrop-blur-sm">
    <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 max-h-[92vh] overflow-y-auto pb-safe">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-black text-pitch uppercase italic flex items-center gap-2"><Wallet className="w-5 h-5" /> Recebimentos</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">As taxas dos jogos caem direto na sua conta Asaas</p>
        </div>
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
      </div>
      <WalletSetup fieldId={field.id} ownerName={currentUser.name} onSaved={onSaved} />
    </div>
  </div>
);
