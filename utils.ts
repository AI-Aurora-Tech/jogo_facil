
import { CATEGORY_ORDER, SPORTS } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

const readPosition = (options: PositionOptions): Promise<LatLng> =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      options
    );
  });

const POSITION_CACHE_KEY = 'jf_last_position';

/** Última posição obtida nesta sessão (para não pedir o GPS toda hora). */
export const getCachedPosition = (): LatLng | null => {
  try {
    const raw = sessionStorage.getItem(POSITION_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Date.now() - (p.at || 0) < 15 * 60_000 ? { lat: p.lat, lng: p.lng } : null;
  } catch {
    return null;
  }
};

/** O navegador já tem permissão de localização? (aí dá para buscar sem perguntar) */
export const hasLocationPermission = async (): Promise<boolean> => {
  try {
    const nav = navigator as Navigator & { permissions?: { query: (d: { name: string }) => Promise<{ state: string }> } };
    if (!nav.permissions) return false;
    const status = await nav.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
};

/**
 * Posição atual do aparelho.
 * 1º tenta rápido (Wi-Fi/rede, aceita posição de até 10 min): suficiente para distância em km.
 * Se falhar, tenta o GPS de alta precisão.
 * highAccuracy = true pula direto para o GPS (ex.: marcar o local exato da arena).
 */
export const getCurrentPosition = async (highAccuracy = false): Promise<LatLng> => {
  if (!("geolocation" in navigator)) {
    throw new Error("Seu navegador não suporta geolocalização.");
  }
  if (window.isSecureContext === false) {
    throw new Error("Geolocalização requer conexão segura (HTTPS).");
  }

  let pos: LatLng | null = null;
  if (!highAccuracy) {
    try {
      pos = await readPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 });
    } catch (e: any) {
      if (e?.code === 1) throw new Error("Permissão de localização negada. Libere a localização para este site nas configurações do navegador.");
    }
  }
  if (!pos) {
    try {
      pos = await readPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch (e: any) {
      if (e?.code === 1) throw new Error("Permissão de localização negada. Libere a localização para este site nas configurações do navegador.");
      throw new Error("Não foi possível obter sua localização. Verifique se o GPS está ativo e se a permissão foi concedida.");
    }
  }
  try {
    sessionStorage.setItem(POSITION_CACHE_KEY, JSON.stringify({ ...pos, at: Date.now() }));
  } catch { /* sem storage */ }
  return pos;
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Qualidade da coordenada:
 * - gps:    marcada no local pelo dono do campo
 * - exact:  rua e número
 * - street: rua (sem número exato)
 * - cep:    centro do CEP
 * - city:   só a cidade (aproximada: não usar como se fosse o endereço)
 * - saved:  já estava salva no campo (origem desconhecida)
 */
export type GeoPrecision = 'gps' | 'exact' | 'street' | 'cep' | 'city' | 'saved';
export interface GeoResult extends LatLng {
  precision: GeoPrecision;
}

export interface AddressParts {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}

// Cache simples em memória
const addressCache: Record<string, GeoResult> = {};

/**
 * Busca dados do endereço via CEP (ViaCEP).
 */
export const fetchAddressByCEP = async (cep: string) => {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf
    };
  } catch (e) {
    return null;
  }
};

/** Coordenadas do CEP pela BrasilAPI (nem todo CEP tem). */
const cepCoordinates = async (cep: string): Promise<LatLng | null> => {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
    if (!res.ok) return null;
    const data = await res.json();
    const lat = Number(data?.location?.coordinates?.latitude);
    const lng = Number(data?.location?.coordinates?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? { lat, lng } : null;
  } catch {
    return null;
  }
};

// Nominatim (OpenStreetMap): no máximo 1 pedido por segundo
let lastNominatimCall = 0;
const nominatim = async (params: Record<string, string>): Promise<{ lat: number; lng: number; type: string } | null> => {
  const wait = lastNominatimCall + 1100 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  try {
    const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'br', ...params });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${qs.toString()}`);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), type: String(data[0].addresstype || data[0].type || '') };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Coordenadas a partir das partes do endereço (cadastro/perfil do campo).
 * Ordem: rua + número > coordenada do CEP > rua sem número > cidade (aproximada).
 */
export const geocodeAddressParts = async (parts: AddressParts): Promise<GeoResult | null> => {
  const key = JSON.stringify(parts);
  if (addressCache[key]) return addressCache[key];

  let { street = '', city = '', state = '' } = parts;
  const number = (parts.number || '').replace(/\D/g, '');
  const cep = (parts.cep || '').replace(/\D/g, '');

  // Completa com o CEP quando faltar rua/cidade
  if (cep.length === 8 && (!street || !city)) {
    const viaCep = await fetchAddressByCEP(cep);
    if (viaCep) {
      street = street || viaCep.logradouro || '';
      city = city || viaCep.localidade || '';
      state = state || viaCep.uf || '';
    }
  }

  const save = (r: GeoResult) => {
    addressCache[key] = r;
    return r;
  };

  if (street && city) {
    // 1. Rua + número (busca estruturada)
    if (number) {
      const r = await nominatim({ street: `${number} ${street}`, city, state, ...(cep.length === 8 ? { postalcode: cep } : {}) });
      if (r) return save({ lat: r.lat, lng: r.lng, precision: ['house', 'building'].includes(r.type) ? 'exact' : 'street' });
    }
  }

  // 2. Coordenada do CEP
  const byCep = cep.length === 8 ? await cepCoordinates(cep) : null;
  if (byCep) return save({ ...byCep, precision: 'cep' });

  if (street && city) {
    // 3. Rua sem número
    const r = await nominatim({ street, city, state });
    if (r) return save({ lat: r.lat, lng: r.lng, precision: 'street' });
  }

  // 4. Só a cidade (aproximada)
  if (city) {
    const r = await nominatim({ city, state });
    if (r) return save({ lat: r.lat, lng: r.lng, precision: 'city' });
  }
  return null;
};

/**
 * Coordenadas a partir do endereço salvo no campo
 * (formato do app: "Rua, Número - Bairro - Cidade - UF, CEP").
 */
export const geocodeAddress = async (address: string): Promise<GeoResult | null> => {
  if (!address) return null;
  const cepMatch = address.match(/(\d{5})[-.]?(\d{3})/);
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : '';
  const withoutCep = address.replace(/(\d{5}[-.]?\d{3})/g, '').replace(/[,\s-]+$/, '');
  const pieces = withoutCep.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
  const [streetPart = '', ...rest] = pieces;
  const numberMatch = streetPart.match(/,\s*(\d+)\b/);
  const street = streetPart.replace(/,\s*(\d+|s\/?n)\b.*$/i, '').trim();
  // "... - Cidade - UF": as duas últimas partes
  const state = rest.length >= 2 && /^[A-Za-z]{2}$/.test(rest[rest.length - 1]) ? rest[rest.length - 1].toUpperCase() : '';
  const city = state ? rest[rest.length - 2] || '' : rest[rest.length - 1] || '';

  const result = await geocodeAddressParts({ street, number: numberMatch?.[1] || '', city, state, cep });
  if (result) return result;

  // Endereço em texto livre (formato fora do padrão)
  const r = await nominatim({ q: `${withoutCep}, Brasil` });
  return r ? { lat: r.lat, lng: r.lng, precision: 'street' } : null;
};

/**
 * Calcula a distância em metros usando a fórmula de Haversine.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return -1;
  
  if ((Math.abs(nLat1) < 0.0001 && Math.abs(nLon1) < 0.0001) || 
      (Math.abs(nLat2) < 0.0001 && Math.abs(nLon2) < 0.0001)) return -1;

  const R = 6371000;
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);

  const aLat1 = toRad(nLat1);
  const aLat2 = toRad(nLat2);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aLat1) * Math.cos(aLat2) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

export const formatDistance = (meters: number): string => {
  if (meters < 0 || !Number.isFinite(meters)) return "--";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

export const getNeighboringCategories = (baseCategory: string): string[] => {
  const idx = CATEGORY_ORDER.indexOf(baseCategory);
  if (idx === -1) return [baseCategory];
  
  const result = [baseCategory];
  if (idx > 0) result.push(CATEGORY_ORDER[idx - 1]);
  if (idx < CATEGORY_ORDER.length - 1) result.push(CATEGORY_ORDER[idx + 1]);
  
  return result;
};

export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const formatCategory = (input: string): string => {
  let cleaned = input.trim().toLowerCase();
  if (!cleaned) return '';
  const subMatch = cleaned.match(/^(?:sub\s*i?|s|categoria\s*)(\d+)$/i);
  if (subMatch) return `Sub-${subMatch[1]}`;
  if (/^\d+$/.test(cleaned)) return `Sub-${cleaned}`;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const plainText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

/** O cadastro de mensalista guarda o esporte em maiúsculas ("FUTEBOL"); horários e telas usam "Futebol". */
export const sportLabel = (sport?: string | null): string =>
  SPORTS.find(s => plainText(s) === plainText(String(sport || ''))) || String(sport || 'Futebol');
