"use client";

import { useCallback, useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import type { ApiStatus } from "@/types";

/** Polls /health and derives a 3-state API status indicator */
export function useHealth(intervalMs = 30_000) {
  const [status, setStatus] = useState<ApiStatus>("ok");
  const [dbReady, setDbReady] = useState(true);
  const [dbBackend, setDbBackend] = useState<string | undefined>();

  const check = useCallback(async () => {
    try {
      const h = await getHealth();
      setDbReady(h.database_ready);
      setDbBackend(h.database_backend);
      if (!h.database_ready) setStatus("db-offline");
      else setStatus("ok");
    } catch {
      setStatus("unreachable");
    }
  }, []);

  useEffect(() => {
    void check();
    const t = setInterval(() => void check(), intervalMs);
    return () => clearInterval(t);
  }, [check, intervalMs]);

  return { status, dbReady, dbBackend };
}
