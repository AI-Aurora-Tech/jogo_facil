import React, { useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { Button } from './Button';
import { MatchSlot } from '../types';
import { api } from '../api';

interface ResultModalProps {
  slot: MatchSlot;
  homeName: string;
  awayName: string;
  onClose: () => void;
  onDone: () => void;
}

const ScoreInput: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex-1 flex flex-col items-center gap-3">
    <span className="text-[10px] font-black text-pitch uppercase text-center line-clamp-2 h-8">{label}</span>
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="p-2 bg-gray-100 rounded-xl"><Minus className="w-4 h-4" /></button>
      <span className="text-4xl font-black text-pitch w-12 text-center">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(99, value + 1))} className="p-2 bg-gray-100 rounded-xl"><Plus className="w-4 h-4" /></button>
    </div>
  </div>
);

/** O time 1 lança o placar (liberado 2h após o fim do jogo). */
export const ResultModal: React.FC<ResultModalProps> = ({ slot, homeName, awayName, onClose, onDone }) => {
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!confirm(`Confirmar placar ${homeName} ${home} x ${away} ${awayName}? Não dá para alterar depois.`)) return;
    setSaving(true);
    try {
      const res = await api.match('set_result', slot.id, { homeScore: home, awayScore: away, notes });
      alert(res.message || 'Placar salvo!');
      onDone();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-pitch/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 pb-safe animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black text-pitch uppercase italic">Placar final</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2 mb-8">
          <ScoreInput label={homeName} value={home} onChange={setHome} />
          <span className="text-gray-300 font-black">x</span>
          <ScoreInput label={awayName} value={away} onChange={setAway} />
        </div>
        <input
          className="w-full p-4 bg-gray-50 rounded-2xl border text-xs font-bold mb-6 outline-none"
          placeholder="Observação (ex.: W.O., jogo interrompido) — opcional"
          maxLength={300}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <Button onClick={submit} isLoading={saving} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Salvar placar</Button>
      </div>
    </div>
  );
};
