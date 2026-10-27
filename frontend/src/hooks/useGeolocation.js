import { useCallback, useState } from "react";

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta geolocalização.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        const messages = {
          1: "Permissão de localização negada. Ative no navegador para ver restaurantes perto de você.",
          2: "Não foi possível obter sua localização.",
          3: "Tempo esgotado ao obter localização.",
        };
        setError(messages[err.code] || "Erro ao obter localização.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  return { coords, error, loading, request };
}
