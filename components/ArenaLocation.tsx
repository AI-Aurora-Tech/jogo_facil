import React, { useState } from 'react';
import { MapPin, Locate, Search, ExternalLink, Loader2 } from 'lucide-react';
import { GeoResult, getCurrentPosition } from '../utils';

interface ArenaLocationProps {
  value: GeoResult | null;
  onChange: (value: GeoResult | null) => void;
  /** Busca as coordenadas pelo endereço preenchido no formulário. */
  onSearchAddress?: () => Promise<GeoResult | null>;
}

const LABEL: Record<GeoResult['precision'], string> = {
  gps: 'Marcada no local da arena',
  exact: 'Encontrada pelo endereço (rua e número)',
  street: 'Encontrada pela rua (sem o número exato)',
  cep: 'Encontrada pelo CEP (aproximada)',
  city: 'Só a cidade foi encontrada: a distância vai ficar errada',
  saved: 'Definida (confira no mapa se está certa)',
};

/**
 * Localização da arena no mapa (usada para mostrar a distância aos times).
 * O jeito mais preciso é o dono do campo marcar estando na arena.
 */
export const ArenaLocation: React.FC<ArenaLocationProps> = ({ value, onChange, onSearchAddress }) => {
  const [busy, setBusy] = useState<'gps' | 'address' | null>(null);
  const good = !!value && value.precision !== 'city';

  const useGps = async () => {
    setBusy('gps');
    try {
      const pos = await getCurrentPosition(true);
      onChange({ ...pos, precision: 'gps' });
    } catch (e: any) {
      alert(e.message || 'Não foi possível pegar sua localização.');
    } finally {
      setBusy(null);
    }
  };

  const searchAddress = async () => {
    if (!onSearchAddress) return;
    setBusy('address');
    try {
      const r = await onSearchAddress();
      if (r && r.precision === 'city') {
        if (confirm('Só encontramos a cidade, não o endereço. A distância para os times vai ficar aproximada. Usar mesmo assim? (O melhor é tocar em "Estou na arena" quando estiver lá.)')) onChange(r);
      } else if (r) onChange(r);
      else alert('Não encontramos esse endereço no mapa. Confira o CEP e o número, ou marque estando na arena.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`p-4 rounded-2xl border space-y-3 ${good ? 'bg-grass-50 border-grass-100' : 'bg-orange-50 border-orange-100'}`}>
      <div className="flex items-start gap-2">
        <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${good ? 'text-grass-600' : 'text-orange-500'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-black uppercase ${good ? 'text-grass-700' : 'text-orange-600'}`}>Localização no mapa</p>
          <p className="text-[10px] font-bold text-gray-500">
            {value ? LABEL[value.precision] : 'Ainda não definida: os times não veem a distância até a arena.'}
          </p>
          {value && (
            <a
              href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-black uppercase text-pitch inline-flex items-center gap-1 mt-1"
            >
              Conferir no mapa <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={useGps} disabled={!!busy} className="py-3 rounded-xl bg-pitch text-white text-[9px] font-black uppercase flex items-center justify-center gap-1 disabled:opacity-60">
          {busy === 'gps' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Locate className="w-3 h-3" />} Estou na arena
        </button>
        {onSearchAddress && (
          <button type="button" onClick={searchAddress} disabled={!!busy} className="py-3 rounded-xl bg-white border text-pitch text-[9px] font-black uppercase flex items-center justify-center gap-1 disabled:opacity-60">
            {busy === 'address' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Buscar pelo endereço
          </button>
        )}
      </div>
      <p className="text-[8px] font-bold text-gray-400 uppercase">Dica: "Estou na arena" usa o GPS do celular e é o mais preciso.</p>
    </div>
  );
};
