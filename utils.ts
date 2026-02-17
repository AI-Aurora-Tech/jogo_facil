
import { CATEGORY_ORDER } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Obtém a posição atual com sistema de fallback.
 * 1. Tenta GPS (Alta precisão) por 5 segundos.
 * 2. Se falhar ou der timeout, tenta Wi-Fi/Torres (Baixa precisão) automaticamente.
 */
export const getCurrentPosition = (options?: PositionOptions): Promise<LatLng> => {
  return new Promise((resolve, reject) => {
    // 1. Verificação básica
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocalização não suportada neste dispositivo."));
      return;
    }

    // Callback de sucesso
    const success = (pos: GeolocationPosition) => {
      resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    };

    // Callback de erro com Fallback Inteligente
    const error = (err: GeolocationPositionError) => {
      console.warn(`Erro GPS Primário (${err.code}): ${err.message}`);
      
      // Se a falha foi no modo High Accuracy (timeout ou indisponível), tenta Low Accuracy
      if (options?.enableHighAccuracy !== false) {
          console.log("Tentando geolocalização aproximada (fallback)...");
          navigator.geolocation.getCurrentPosition(
            success,
            (errFinal) => {
                const msg = getFriendlyErrorMessage(errFinal);
                reject(new Error(msg));
            },
            { 
              ...options, 
              enableHighAccuracy: false, 
              timeout: 10000, 
              maximumAge: 0 
            }
          );
      } else {
        const msg = getFriendlyErrorMessage(err);
        reject(new Error(msg));
      }
    };

    // 2. Primeira tentativa: Alta precisão com Timeout Curto
    navigator.geolocation.getCurrentPosition(
      success,
      error,
      {
        enableHighAccuracy: true,
        timeout: 5000, // 5 segundos para tentar pegar satélite
        maximumAge: 0,
        ...options,
      }
    );
  });
};

function getFriendlyErrorMessage(err: GeolocationPositionError): string {
  switch(err.code) {
    case 1: return "Permissão de localização negada. Verifique as configurações do seu navegador.";
    case 2: return "Sinal de GPS indisponível. Vá para um local a céu aberto.";
    case 3: return "Tempo limite esgotado. O sinal está fraco.";
    default: return `Erro desconhecido: ${err.message}`;
  }
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Calcula a distância em metros usando a fórmula de Haversine.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return -1;
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return -1;
  
  // Ignora coordenadas padrão (0,0)
  if ((Math.abs(lat1) < 0.0001 && Math.abs(lon1) < 0.0001) || 
      (Math.abs(lat2) < 0.0001 && Math.abs(lon2) < 0.0001)) return -1;

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
