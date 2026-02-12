
import { CATEGORY_ORDER } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

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
      // Se falhar no modo high accuracy, tenta modo normal automaticamente (fallback)
      if (options?.enableHighAccuracy !== false) {
         console.warn("GPS de alta precisão falhou, tentando modo rápido...");
         navigator.geolocation.getCurrentPosition(
            success,
            (errFinal) => reject(errFinal),
            { ...options, enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
         );
      } else {
        reject(err);
      }
    };

    navigator.geolocation.getCurrentPosition(
      success,
      error,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
        ...options,
      }
    );
  });
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  // Retorna a distância em METROS. Se inválido, retorna -1.
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return -1;
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return -1;
  if (lat1 === 0 && lon1 === 0) return -1; // Evita cálculo se coordenadas forem default 0
  
  const R = 6371000; // Raio da Terra em metros
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const formatDistance = (meters: number): string => {
  if (meters < 0 || !Number.isFinite(meters)) return "--";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

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
