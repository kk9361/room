import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useEffect(() => {
    let live = true;
    if (!path) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    api<T>(path)
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, version]);
  return { data, loading, error, refresh };
}
