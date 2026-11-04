import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Home, Plane, Loader2, Crosshair, Users, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { CATEGORY_ORDER, DirectoryTeam, User } from '../types';
import { LatLng, calculateDistance, formatDistance, getCachedPosition, getCurrentPosition, hasLocationPermission } from '../utils';

interface TeamsDirectoryProps {
  currentUser: User;
  /** Abre a agenda do time (link exclusivo), onde dá para "Jogar". */
  onOpenAgenda: (token: string) => void;
  onUserUpdated?: (u: User) => void;
}

const RADIUS_OPTIONS = [5, 10, 20, 50, 100];
const GENDERS: { value: string; label: string }[] = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'MISTO', label: 'Misto' },
];
const genderLabel = (g?: string | null) => GENDERS.find(x => x.value === g)?.label || null;

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dateLabel = (d: string) => {
  const dt = new Date(`${d}T12:00:00`);
  return `${WEEKDAYS[dt.getDay()]} ${d.split('-').reverse().slice(0, 2).join('/')}`;
};

const chip = (active: boolean) =>
  `px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${active ? 'bg-pitch text-white border-pitch' : 'bg-white text-gray-500 border-gray-200'}`;

/**
 * Aba "Times": todos os times disponíveis para marcar jogo
 * (jogo em casa aberto ou dias em que querem jogar fora), com filtros.
 */
export const TeamsDirectory: React.FC<TeamsDirectoryProps> = ({ currentUser, onOpenAgenda, onUserUpdated }) => {
  const [teams, setTeams] = useState<DirectoryTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [coords, setCoords] = useState<LatLng | null>(() => getCachedPosition());
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState<number | null>(null);
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [kind, setKind] = useState<'' | 'HOME' | 'AWAY'>('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingGender, setSavingGender] = useState(false);
  const teamsWithoutGender = (currentUser.teams || []).filter(t => !t.gender);

  /** Times criados antes da escolha obrigatória: pede o sexo do time uma vez. */
  const saveGender = async (teamName: string, value: string) => {
    setSavingGender(true);
    try {
      const teamsUpdated = (currentUser.teams || []).map(t => t.name === teamName ? { ...t, gender: value as any } : t);
      const updated = await api.updateUser({ ...currentUser, teams: teamsUpdated });
      onUserUpdated?.(updated);
    } catch (e: any) {
      alert(e.message || 'Não foi possível salvar.');
    } finally {
      setSavingGender(false);
    }
  };

  const myCategories = useMemo(
    () => Array.from(new Set((currentUser.teams || []).flatMap(t => t.categories || []))),
    [currentUser.teams]
  );
  const hasTeamLocation = Math.abs(Number(currentUser.latitude) || 0) > 0.0001;

  const load = () => {
    setLoading(true);
    setError('');
    api.teamsDirectory()
      .then(res => setTeams(res.teams))
      .catch((e: any) => setError(e.message || 'Não foi possível carregar os times.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (!coords) {
      hasLocationPermission().then(granted => {
        if (granted) getCurrentPosition().then(setCoords).catch(() => setGpsError(true));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askGps = async () => {
    setGpsLoading(true);
    setGpsError(false);
    try {
      const pos = await getCurrentPosition();
      setCoords(pos);
      return pos;
    } catch {
      setGpsError(true);
      return null;
    } finally {
      setGpsLoading(false);
    }
  };

  const chooseRadius = async (r: number | null) => {
    setRadius(r);
    if (r !== null && !coords) await askGps();
  };

  const saveTeamLocation = async () => {
    setSavingLocation(true);
    try {
      const pos = coords || (await askGps());
      if (!pos) return;
      await api.setTeamLocation(currentUser.id, pos.lat, pos.lng);
      onUserUpdated?.({ ...currentUser, latitude: pos.lat, longitude: pos.lng });
      alert('Localização do seu time salva! Outros times vão te encontrar pela distância.');
    } catch (e: any) {
      alert(e.message || 'Não foi possível salvar a localização.');
    } finally {
      setSavingLocation(false);
    }
  };

  const withDistance = useMemo(
    () => teams.map(t => ({
      ...t,
      distance: coords && t.location ? calculateDistance(coords.lat, coords.lng, t.location.lat, t.location.lng) : null,
    })),
    [teams, coords]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = withDistance.filter(t => {
      if (q && !t.teamName.toLowerCase().includes(q)) return false;
      if (gender && t.gender !== gender) return false;
      if (kind === 'HOME' && t.homeGames === 0) return false;
      if (kind === 'AWAY' && t.awayDays === 0) return false;
      if (category) {
        const cats = kind === 'HOME' ? t.homeCategories : kind === 'AWAY' ? t.awayCategories : [...t.homeCategories, ...t.awayCategories, ...t.categories];
        if (!cats.includes(category)) return false;
      }
      if (radius !== null && coords) {
        if (t.distance === null || t.distance > radius * 1000) return false;
      }
      return true;
    });
    if (coords) list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return list;
  }, [withDistance, search, gender, kind, category, radius, coords]);

  const categoryOptions = useMemo(() => {
    const present = new Set(teams.flatMap(t => [...t.categories, ...t.homeCategories, ...t.awayCategories]));
    return CATEGORY_ORDER.filter(c => present.has(c) || myCategories.includes(c));
  }, [teams, myCategories]);

  const activeFilters = [search, radius, category, gender, kind].filter(v => v !== '' && v !== null).length;
  const clearFilters = () => { setSearch(''); setRadius(null); setCategory(''); setGender(''); setKind(''); };

  return (
    <div className="p-4 pb-32 space-y-4">
      <div>
        <h2 className="text-2xl font-black text-pitch italic uppercase tracking-tighter">Times disponíveis</h2>
        <p className="text-xs text-gray-500 font-bold">Times com jogo em casa aberto ou dias para jogar fora. Toque para ver a agenda e jogar.</p>
      </div>

      {teamsWithoutGender.map(t => (
        <div key={t.name} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-[11px] text-amber-800 font-bold">Qual o sexo do time <b>{t.name}</b>? Assim os outros times te acham no filtro.</p>
          <div className="flex gap-2">
            {GENDERS.map(g => (
              <button key={g.value} disabled={savingGender} onClick={() => saveGender(t.name, g.value)} className="flex-1 py-2 rounded-xl bg-white border border-amber-200 text-[10px] font-black uppercase text-pitch disabled:opacity-60">
                {g.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {!hasTeamLocation && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <MapPin className="w-6 h-6 text-grass-500 shrink-0" />
          <p className="text-[11px] text-gray-600 font-bold flex-1">Marque a localização do seu time para outros times te acharem pela distância.</p>
          <button onClick={saveTeamLocation} disabled={savingLocation} className="px-3 py-2 rounded-xl bg-pitch text-white text-[10px] font-black uppercase flex items-center gap-1 disabled:opacity-60">
            {savingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />} Usar GPS
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="w-full pl-9 pr-3 py-3 rounded-xl bg-gray-50 text-sm font-bold outline-none"
            placeholder="Buscar time pelo nome"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div>
          <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Distância</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button className={chip(radius === null)} onClick={() => chooseRadius(null)}>Qualquer</button>
            {RADIUS_OPTIONS.map(r => (
              <button key={r} className={chip(radius === r)} onClick={() => chooseRadius(r)}>Até {r} km</button>
            ))}
          </div>
          {radius !== null && !coords && (
            <p className="text-[10px] text-red-500 font-bold mt-1">
              {gpsLoading ? 'Pegando sua localização…' : gpsError ? 'Libere a localização do celular para filtrar por distância.' : 'Precisamos da sua localização.'}
              {!gpsLoading && <button onClick={askGps} className="underline ml-1">Tentar de novo</button>}
            </p>
          )}
        </div>

        <div>
          <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Categoria</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button className={chip(category === '')} onClick={() => setCategory('')}>Todas</button>
            {categoryOptions.map(c => (
              <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>
                {c}{myCategories.includes(c) ? ' ★' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Sexo</p>
            <div className="flex gap-1 flex-wrap">
              <button className={chip(gender === '')} onClick={() => setGender('')}>Todos</button>
              {GENDERS.map(g => <button key={g.value} className={chip(gender === g.value)} onClick={() => setGender(g.value)}>{g.label}</button>)}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Tipo de jogo</p>
            <div className="flex gap-1 flex-wrap">
              <button className={chip(kind === '')} onClick={() => setKind('')}>Todos</button>
              <button className={chip(kind === 'HOME')} onClick={() => setKind('HOME')}>Na casa deles</button>
              <button className={chip(kind === 'AWAY')} onClick={() => setKind('AWAY')}>Na sua casa</button>
            </div>
          </div>
        </div>

        {activeFilters > 0 && (
          <button onClick={clearFilters} className="text-[10px] font-black uppercase text-grass-600">Limpar filtros ({activeFilters})</button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-grass-500" /></div>
      ) : error ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-sm text-red-500 font-bold">{error}</p>
          <button onClick={load} className="text-xs font-black uppercase text-pitch flex items-center gap-1 mx-auto"><RefreshCw className="w-4 h-4" /> Tentar de novo</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm font-bold">{teams.length === 0 ? 'Nenhum time com agenda aberta agora.' : 'Nenhum time com esses filtros.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase text-gray-400">{filtered.length} time(s)</p>
          {filtered.map(t => (
            <button
              key={t.token}
              onClick={() => onOpenAgenda(t.token)}
              className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-all"
            >
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-pitch text-white flex items-center justify-center font-black shrink-0">
                  {t.teamName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black text-pitch uppercase truncate">{t.teamName}</p>
                <p className="text-[10px] text-gray-500 font-bold truncate">
                  {[genderLabel(t.gender), (t.categories || []).join(', ')].filter(Boolean).join(' • ')}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {t.homeGames > 0 && (
                    <span className="text-[9px] font-black uppercase text-grass-700 bg-grass-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Home className="w-3 h-3" /> {t.homeGames} jogo(s) em casa
                    </span>
                  )}
                  {t.awayDays > 0 && (
                    <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Plane className="w-3 h-3" /> {t.awayDays} dia(s) para jogar fora
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 font-bold mt-1 flex items-center gap-1">
                  {t.nextDate && <>Próximo: {dateLabel(t.nextDate)}</>}
                  {t.distance !== null && <><MapPin className="w-3 h-3 ml-1" /> {formatDistance(t.distance)}{t.location?.source === 'arena' && t.location.label ? ` (${t.location.label})` : ''}</>}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {hasTeamLocation && (
        <button onClick={saveTeamLocation} disabled={savingLocation} className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1 mx-auto">
          <Crosshair className="w-3 h-3" /> Atualizar localização do meu time
        </button>
      )}
    </div>
  );
};
