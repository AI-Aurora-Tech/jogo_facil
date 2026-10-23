import React, { useState } from 'react';
import { X, Star } from 'lucide-react';
import { Button } from './Button';
import { MatchSlot } from '../types';
import { api } from '../api';
import { TEAM_RATING_TAGS, FIELD_RATING_TAGS } from '../shared/matchRules';

interface RatingModalProps {
  slot: MatchSlot;
  opponentName: string;
  fieldName: string;
  /** O dono do campo jogando com o time da casa não avalia o próprio campo. */
  canRateField: boolean;
  onClose: () => void;
  onDone: () => void;
}

const Stars: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <div className="flex gap-2 justify-center">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button" onClick={() => onChange(n)} className="p-1 active:scale-90 transition-transform" aria-label={`${n} estrelas`}>
        <Star className={`w-9 h-9 ${n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
      </button>
    ))}
  </div>
);

const Tags: React.FC<{ options: string[]; selected: string[]; onToggle: (t: string) => void }> = ({ options, selected, onToggle }) => (
  <div className="flex flex-wrap gap-2 justify-center">
    {options.map(t => (
      <button
        key={t}
        type="button"
        onClick={() => onToggle(t)}
        className={`px-3 py-2 rounded-full text-[9px] font-black uppercase border transition-all ${selected.includes(t) ? 'bg-pitch text-white border-pitch' : 'bg-gray-50 text-gray-400'}`}
      >
        {t}
      </button>
    ))}
  </div>
);

/** Avaliação pós-jogo: nota de 1 a 5 + tags rápidas para o adversário e para o campo. */
export const RatingModal: React.FC<RatingModalProps> = ({ slot, opponentName, fieldName, canRateField, onClose, onDone }) => {
  const [teamScore, setTeamScore] = useState(0);
  const [teamTags, setTeamTags] = useState<string[]>([]);
  const [fieldScore, setFieldScore] = useState(0);
  const [fieldTags, setFieldTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void) => (t: string) =>
    set(list.includes(t) ? list.filter(x => x !== t) : [...list, t]);

  const submit = async () => {
    if (!teamScore && !fieldScore) {
      alert('Dê pelo menos uma nota.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.match('rate', slot.id, { teamScore, teamTags, fieldScore: canRateField ? fieldScore : 0, fieldTags, comment });
      alert(res.message || 'Avaliação enviada!');
      onDone();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-pitch/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 max-h-[92vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-pitch uppercase italic">Avaliar partida</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-8">
          <section className="space-y-3 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">Adversário</p>
            <p className="font-black text-pitch uppercase">{opponentName}</p>
            <Stars value={teamScore} onChange={setTeamScore} />
            <Tags options={TEAM_RATING_TAGS} selected={teamTags} onToggle={toggle(teamTags, setTeamTags)} />
          </section>

          {canRateField && (
            <section className="space-y-3 text-center border-t pt-6">
              <p className="text-[10px] font-black text-gray-400 uppercase">Campo</p>
              <p className="font-black text-pitch uppercase">{fieldName}</p>
              <Stars value={fieldScore} onChange={setFieldScore} />
              <Tags options={FIELD_RATING_TAGS} selected={fieldTags} onToggle={toggle(fieldTags, setFieldTags)} />
            </section>
          )}

          <textarea
            className="w-full h-24 bg-gray-50 rounded-2xl p-4 text-xs font-bold text-pitch outline-none resize-none border"
            placeholder="Comentário (opcional)"
            maxLength={500}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />

          <Button onClick={submit} isLoading={saving} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Enviar avaliação</Button>
        </div>
      </div>
    </div>
  );
};
