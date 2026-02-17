
import { CATEGORY_ORDER } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Obtém a posição atual com sistema de fallback.
 */
export const getCurrentPosition = (options?: PositionOptions): Promise<LatLng> => {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocalização não suportada."));
      return;
    }

    const success = (pos: GeolocationPosition) => {
      resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    };

    const error = (err: GeolocationPositionError) => {
      console.warn(`Erro GPS Primário (${err.code}): ${err.message}`);
      
      // Fallback: Tenta novamente com precisão menor e timeout maior
      if (options?.enableHighAccuracy !== false) {
          // console.log("Tentando fallback com baixa precisão...");
          navigator.geolocation.getCurrentPosition(
            success,
            (errFinal) => {
                const msg = getFriendlyErrorMessage(errFinal);
                reject(new Error(msg));
            },
            { maximumAge: 0, timeout: 15000, enableHighAccuracy: false }
          );
      } else {
        const msg = getFriendlyErrorMessage(err);
        reject(new Error(msg));
      }
    };

    // Tenta primeiro com alta precisão
    navigator.geolocation.getCurrentPosition(
      success,
      error,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options }
    );
  });
};

function getFriendlyErrorMessage(err: GeolocationPositionError): string {
  switch(err.code) {
    case 1: return "GPS Permissão Negada. Ative a localização no seu navegador/celular.";
    case 2: return "Sinal GPS Indisponível.";
    case 3: return "Tempo limite do GPS esgotado.";
    default: return "Erro ao obter localização.";
  }
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Cache simples em memória para evitar requisições repetidas para o mesmo endereço
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
 * Busca coordenadas (Lat/Lng) a partir de um endereço usando OpenStreetMap (Nominatim).
 */
export const geocodeAddress = async (address: string): Promise<LatLng | null> => {
  if (!address) return null;
  if (addressCache[address]) return addressCache[address];

  const doFetch = async (q: string) => {
     try {
       // Pequeno delay para evitar rate limit
       await new Promise(r => setTimeout(r, 300));
       const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
       const response = await fetch(url, {
          headers: { 'User-Agent': 'JogoFacilApp/1.0' }
       });
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
    // 1. Limpeza do endereço (Troca traços por vírgulas para ajudar o Nominatim)
    // Ex: "Rua X - Bairro Y" vira "Rua X, Bairro Y"
    const cleanAddress = address.replace(/ - /g, ', ').replace(/-/g, ', ');
    
    // Tenta query completa
    const fullQuery = cleanAddress.toLowerCase().includes('brasil') ? cleanAddress : `${cleanAddress}, Brasil`;
    let result = await doFetch(fullQuery);

    // 2. Fallback: Tenta simplificar se falhar
    if (!result && address.includes(',')) {
       const parts = address.split(',');
       // Tenta pegar: Parte 1 (Rua) + Última Parte (Cidade/Estado)
       if (parts.length >= 2) {
          const simplified = `${parts[0]}, ${parts[parts.length-1]}`.replace(/ - /g, ', ');
          result = await doFetch(simplified + ", Brasil");
       }
    }
    
    // 3. Fallback agressivo: Tenta apenas a primeira parte (Nome da Rua) + Cidade se possível
    if (!result && address.includes('-')) {
        const parts = address.split('-');
        if (parts.length >= 2) {
             // Tenta: Rua + Cidade (assumindo que a última parte é cidade/estado)
             const simplified = `${parts[0].trim()}, ${parts[parts.length-1].trim()}, Brasil`;
             result = await doFetch(simplified);
        }
    }

    if (result) {
      addressCache[address] = result;
      return result;
    }
    return null;
  } catch (error) {
    console.error("Erro ao geocodificar:", error);
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
