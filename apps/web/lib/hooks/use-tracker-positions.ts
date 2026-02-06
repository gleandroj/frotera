"use client";

import { useEffect, useState, useRef } from "react";
import { buildTrackerPositionsSocket, getAccessToken } from "@/lib/frontend/api-client";

export interface StreamPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}

export function useTrackerPositions(
  deviceId: string | null,
  organizationId: string | null
) {
  const [positions, setPositions] = useState<StreamPosition[]>([]);
  const [lastPosition, setLastPosition] = useState<StreamPosition | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<ReturnType<typeof buildTrackerPositionsSocket> | null>(null);

  const stableOrgId = organizationId ?? null;
  const stableDeviceId = deviceId ?? null;

  useEffect(() => {
    if (!stableDeviceId || !stableOrgId) {
      setConnected(false);
      return;
    }

    const socket = buildTrackerPositionsSocket(stableOrgId);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setTimeout(() => {
        socket.emit("subscribe", { deviceId: stableDeviceId });
      }, 1000);
      console.log("connected to tracker positions socket");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("positions:batch", (batch: StreamPosition[]) => {
      if (!Array.isArray(batch) || batch.length === 0) return;
      setPositions((prev) => [...prev, ...batch]);
      const last = batch[batch.length - 1];
      setLastPosition(last);
    });

    socket.auth = {
      token: getAccessToken(),
      organizationId: stableOrgId,
    };
    socket.connect();

    return () => {
      socket.emit("unsubscribe", { deviceId: stableDeviceId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [stableDeviceId, stableOrgId]);

  return { positions, lastPosition, connected };
}
