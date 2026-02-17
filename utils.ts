
import { CATEGORY_ORDER } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Tenta obter a posição via getCurrentPosition.
 */
const attemptGetCurrentPosition = (timeout: number): Promise<LatLng> => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
};

/**
 * Tenta obter a posição via watchPosition (fallback robusto).
 */
const attemptWatchPosition = (timeout: number): Promise<LatLng> => {
  return new Promise((resolve, reject) => {
    let done = false;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (done) return;
        done = true;
        navigator.geolocation.clearWatch(id);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
         console.warn("WatchPosition error (retrying):", err);
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    setTimeout(() => {
      if (!done) {
        done = true;
        navigator.geolocation.clearWatch(id);
        reject(new Error("Timeout ao aguardar sinal GPS (watch)."));
      }
    }, timeout);
  });
};

/**
 * Obtém a posição atual com sistema de fallback robusto.
 */
export const getCurrentPosition = async (): Promise<LatLng> => {
  if (!("geolocation" in navigator)) {
    throw new Error("Seu navegador não suporta geolocalização.");
  }

  // Nota: localhost é considerado seguro.
  if (window.isSecureContext === false) {
    throw new Error("Geolocalização requer conexão segura (HTTPS).");
  }

  try {
    return await attemptGetCurrentPosition(5000);
  } catch (e) {
    console.log("getCurrentPosition falhou, tentando fallback watchPosition...");
    try {
      return await attemptWatchPosition(7000);
    } catch (e2) {
      throw new Error("Não foi possível obter sua localização. Verifique se o GPS está ativo e se a permissão foi concedida.");
    }
  }
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Cache simples em memória
const addressCache: Record<string, LatLng> = {};

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

/**
 * Busca coordenadas (Lat/Lng) a partir de um endereço de forma INTELIGENTE.
 */
export const geocodeAddress = async (address: string): Promise<LatLng | null> => {
  if (!address) return null;
  if (addressCache[address]) return addressCache[address];

  // Helper para fetch no Nominatim com retry/delay e User-Agent correto
  const doFetch = async (q: string) => {
     try {
       await new Promise(r => setTimeout(r, 600)); // Delay para evitar bloqueio (Rate Limit)
       // addressdetails=1 ajuda a debugar se necessário, mas q=... é o principal
       const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
       const response = await fetch(url, { headers: { 'User-Agent': 'JogoFacilApp/1.0' } });
       const data = await response.json();
       if (data && data.length > 0) {
         return {
           lat: parseFloat(data[0].lat),
           lng: parseFloat(data[0].lon)
         };
       }
       return null;
     } catch (e) { return null; }
  };

  try {
    // ESTRATÉGIA 1: Extração via CEP (A mais precisa)
    // Procura por padrão de CEP (XXXXX-XXX ou XXXXXXXX)
    const cepMatch = address.match(/(\d{5}[-.]?\d{3})/);
    let cepData = null;
    
    if (cepMatch) {
        cepData = await fetchAddressByCEP(cepMatch[0]);
    }

    // Tenta extrair o número do endereço original (geralmente dígitos isolados após vírgula ou nome da rua)
    const numberMatch = address.match(/[,\s]+(\d+)([,\s-]|$)/);
    const number = numberMatch ? numberMatch[1] : '';

    if (cepData) {
        // Se temos dados do CEP, montamos uma query limpa: "Rua, Numero, Cidade, Estado, Brasil"
        let q = '';
        
        // Tentativa 1: Completa
        if (number) {
            q = `${cepData.logradouro}, ${number}, ${cepData.localidade}, ${cepData.uf}, Brasil`;
            const res = await doFetch(q);
            if (res) { addressCache[address] = res; return res; }
        }

        // Tentativa 2: Sem número (centro da rua)
        q = `${cepData.logradouro}, ${cepData.localidade}, ${cepData.uf}, Brasil`;
        const res = await doFetch(q);
        if (res) { addressCache[address] = res; return res; }
    }

    // ESTRATÉGIA 2: Limpeza da String Original (Fallback)
    // Remove o CEP da string original, pois o Nominatim costuma falhar se o CEP estiver lá mas não linkado no mapa
    let clean = address.replace(/(\d{5}[-.]?\d{3})/g, '').trim();
    // Remove pontuações finais
    clean = clean.replace(/[,.-]+$/, '');
    // Troca " - " por ", " (Nominatim prefere vírgulas)
    clean = clean.replace(/\s+-\s+/g, ', ');
    
    // Tenta buscar a string limpa
    let res = await doFetch(`${clean}, Brasil`);
    if (res) { addressCache[address] = res; return res; }

    // ESTRATÉGIA 3: Fallback Agressivo (Apenas Cidade/Bairro)
    // Se falhar tudo, tenta achar pelo menos a cidade para não dar erro total
    if (cepData) {
         res = await doFetch(`${cepData.localidade}, ${cepData.uf}, Brasil`);
         if (res) return res; 
    }

    // Última tentativa: Se tiver vírgula, tenta pegar a primeira parte (Rua) e a última (Cidade?)
    const parts = clean.split(',');
    if (parts.length >= 2) {
        const simplified = `${parts[0].trim()}, ${parts[parts.length-1].trim()}, Brasil`;
        res = await doFetch(simplified);
        if (res) { addressCache[address] = res; return res; }
    }

    return null;
  } catch (error) {
    console.error("Geocoding fatal error:", error);
    return null;
  }
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
