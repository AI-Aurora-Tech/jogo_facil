import React, { useState } from 'react';
import { Check, X, Send, Trophy, Star, Clock, LogOut } from 'lucide-react';
import { Button } from './Button';
import { Field, MatchSlot, User } from '../types';
import { api } from '../api';
import { ResultModal } from './ResultModal';
import { RatingModal } from './RatingModal';
import { shareInvite } from './shareInvite';
import {
  canRate,
  canSetResult,
  firstTeamUserId,
  hasHomeTeam,
  resultOpensAt,
  FIELD_APPROVAL_STATUSES,
  STATUS_LABEL,
} from '../shared/matchRules';

interface MatchActionsProps {
  slot: MatchSlot;
  field?: Field;
  currentUser: User;
  onChanged: () => void;
}

export const firstTeamNameOf = (slot: MatchSlot) => (slot.hasLocalTeam ? slot.localTeamName : slot.bookedByTeamName) || 'Time 1';

/**
 * Painel de ações da partida para os TIMES (time 1 e adversário):
 * aprovar adversário, convidar, desistir, lançar placar e avaliar.
 */
export const MatchActions: React.FC<MatchActionsProps> = ({ slot, field, currentUser, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showRating, setShowRating] = useState(false);

  const ownerId = field?.ownerId || '';
  const isFirst = firstTeamUserId(slot, ownerId) === currentUser.id;
  const isOpponent = !!slot.opponentUserId && slot.opponentUserId === currentUser.id;
  if (!isFirst && !isOpponent) return null;

  const firstName = firstTeamNameOf(slot);
  const opponentName = slot.opponentTeamName || 'Adversário';
  // Até o campo confirmar, o adversário pode desistir e o time de fora pode cancelar a reserva
  const canLeave = isOpponent || (!hasHomeTeam(slot) && slot.bookedByUserId === currentUser.id);

  const run = async (action: Parameters<typeof api.match>[0], params: Record<string, unknown> = {}, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await api.match(action, slot.id, params);
      if (res?.message) alert(res.message);
      onChanged();
    } catch (e: any) {
      alert(e.message);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const box = 'p-4 rounded-2xl border space-y-3';
  const small = 'py-3 rounded-xl text-[9px] font-black uppercase';

  return (
    <div className="space-y-3">
      {/* Aguardando adversário: time 1 envia convite */}
      {slot.status === 'waiting_opponent' && isFirst && (
        <div className={`${box} bg-blue-50 border-blue-100`}>
          <p className="text-[10px] font-black text-blue-700 uppercase">Seu jogo está aberto. Chame um adversário!</p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => shareInvite(slot.id)} className={`${small} bg-pitch`}><Send className="w-4 h-4" /> Enviar convite</Button>
            {!hasHomeTeam(slot) && (
              <Button onClick={() => run('cancel', {}, 'Cancelar sua reserva? O horário volta a ficar livre.')} variant="outline" isLoading={busy} className={`${small} text-red-500 border-red-200`}>
                <LogOut className="w-4 h-4" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Time 1 aprova o adversário */}
      {slot.status === 'pending_home_approval' && isFirst && (
        <div className={`${box} bg-orange-50 border-orange-100`}>
          <p className="text-[10px] font-black text-orange-600 uppercase">
            {opponentName} ({slot.opponentTeamCategory}) quer jogar. Aprovar a partida?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => run('team_decision', { approve: false }, `Recusar ${opponentName}?`)} variant="outline" isLoading={busy} className={`${small} text-red-500 border-red-200`}>
              <X className="w-4 h-4" /> Recusar
            </Button>
            <Button onClick={() => run('team_decision', { approve: true })} isLoading={busy} className={`${small} bg-pitch`}>
              <Check className="w-4 h-4" /> Aprovar
            </Button>
          </div>
        </div>
      )}

      {slot.status === 'pending_home_approval' && isOpponent && (
        <div className={`${box} bg-gray-50`}>
          <p className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2"><Clock className="w-4 h-4" /> Aguardando {firstName} aprovar</p>
          <Button onClick={() => run('cancel', {}, 'Desistir desta partida?')} variant="outline" isLoading={busy} className={`${small} w-full text-red-500 border-red-200`}>Desistir</Button>
        </div>
      )}

      {FIELD_APPROVAL_STATUSES.includes(slot.status) && (
        <div className={`${box} bg-gray-50`}>
          <p className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2"><Clock className="w-4 h-4" /> {STATUS_LABEL.pending_field_approval}</p>
          {canLeave && (
            <button onClick={() => run('cancel', {}, isOpponent ? 'Desistir desta partida?' : 'Cancelar sua reserva?')} className="text-[9px] font-black text-red-400 uppercase w-full text-center">
              {isOpponent ? 'Desistir da partida' : 'Cancelar reserva'}
            </button>
          )}
        </div>
      )}

      {/* Pós-jogo */}
      {slot.status === 'confirmed' && isFirst && canSetResult(slot) && (
        <Button onClick={() => setShowResult(true)} className={`${small} w-full bg-pitch`}><Trophy className="w-4 h-4" /> Lançar placar</Button>
      )}
      {slot.status === 'confirmed' && !canRate(slot) && (
        <p className="text-[9px] font-bold text-gray-400 uppercase text-center">
          Placar e avaliação liberados em {resultOpensAt(slot).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {slot.status === 'finished' && slot.homeScore != null && (
        <div className="p-4 rounded-2xl bg-pitch text-white flex items-center justify-between">
          <span className="text-[10px] font-black uppercase truncate">{firstName}</span>
          <span className="text-2xl font-black mx-3">{slot.homeScore} x {slot.awayScore}</span>
          <span className="text-[10px] font-black uppercase truncate text-right">{opponentName}</span>
        </div>
      )}
      {canRate(slot) && (
        <Button onClick={() => setShowRating(true)} variant="outline" className={`${small} w-full border-yellow-300 text-yellow-600`}>
          <Star className="w-4 h-4" /> Avaliar adversário e campo
        </Button>
      )}

      {showResult && (
        <ResultModal slot={slot} homeName={firstName} awayName={opponentName} onClose={() => setShowResult(false)} onDone={() => { setShowResult(false); onChanged(); }} />
      )}
      {showRating && (
        <RatingModal
          slot={slot}
          opponentName={isOpponent ? firstName : opponentName}
          fieldName={field?.name || 'Campo'}
          canRateField={currentUser.id !== ownerId}
          onClose={() => setShowRating(false)}
          onDone={() => { setShowRating(false); onChanged(); }}
        />
      )}
    </div>
  );
};
