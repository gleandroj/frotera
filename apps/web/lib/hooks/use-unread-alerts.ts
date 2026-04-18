"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildTelemetryAlertsSocket,
  telemetryAPI,
} from "@/lib/frontend/api-client";

/**
 * Polls alert stats and listens for new alerts over WebSocket to drive sidebar badge count.
 */
export function useUnreadAlerts(orgId: string | undefined): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!orgId) return;
    telemetryAPI
      .getAlertStats(orgId)
      .then((res) => setCount(res.data.unacknowledged ?? 0))
      .catch(() => setCount(0));
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setCount(0);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [orgId, refresh]);

  useEffect(() => {
    if (!orgId) return;
    const socket = buildTelemetryAlertsSocket(orgId);
    socket.connect();
    const onNew = () => {
      refresh();
    };
    socket.on("telemetry:alert", onNew);
    return () => {
      socket.off("telemetry:alert", onNew);
      socket.disconnect();
    };
  }, [orgId, refresh]);

  return count;
}
