
import { CATEGORY_ORDER } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Obtém a posição atual com alta precisão e timeout.
 * Baseado na sugestão robusta para evitar travamentos.
 */
export const getCurrentPosition = (options?: PositionOptions): Promise<LatLng> => {
  return new Promise((resolve, reject) => {
    // Verificação de ambiente
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocalização não suportada neste dispositivo."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("Erro GPS:", err);
        let msg = `Falha ao obter localização (Erro ${err.code}): ${err.message}`;
        if (err.code === 1) msg = "Permissão de localização negada. Ative nas configurações.";
        else if (err.code === 2) msg = "Sinal de GPS indisponível ou fraco.";
        else if (err.code === 3) msg = "Tempo limite esgotado ao buscar GPS.";
        
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true, // Tenta usar GPS nativo
        timeout: 15000,           // 15 segundos de timeout (mais seguro)
        maximumAge: 0,            // Não usa cache antigo
        ...options,
      }
    );
  });
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Calcula a distância em metros usando a fórmula de Haversine.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  // Validações básicas
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return -1;
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return -1;
  
  // Evita cálculo se coordenadas forem zero (padrão de banco vazio)
  if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) return -1;

  const R = 6371000; // Raio da Terra em metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const aLat1 = toRad(lat1);
  const aLat2 = toRad(lat2);

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
