"use client";

import { useEffect, useRef, useState } from "react";
import { buildTrackerPositionsSocket, getAccessToken } from "@/lib/frontend/api-client";

export interface FleetStreamPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
  receivedAt: string | null;
  ignitionOn: boolean | null;
  voltageLevel: number | null;
  odometerKm: number | null;
  city: string | null;
}

export function useFleetPositions(
  deviceIds: string[],
  organizationId: string | null,
) {
  const [positionMap, setPositionMap] = useState<Map<string, FleetStreamPosition>>(new Map());
  const socketRef = useRef<ReturnType<typeof buildTrackerPositionsSocket> | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!organizationId || deviceIds.length === 0) {
      return;
    }

    const socket = buildTrackerPositionsSocket(organizationId);
    socketRef.current = socket;

    socket.on("connect", () => {
      for (const deviceId of deviceIds) {
        if (!subscribedRef.current.has(deviceId)) {
          setTimeout(() => socket.emit("subscribe", { deviceId }), 200);
          subscribedRef.current.add(deviceId);
        }
      }
    });

    socket.on("positions:batch", (batch: (FleetStreamPosition & { deviceId: string })[]) => {
      if (!Array.isArray(batch) || batch.length === 0) return;
      setPositionMap((prev) => {
        const next = new Map(prev);
        for (const pos of batch) {
          if (pos.deviceId) {
            next.set(pos.deviceId, pos);
          }
        }
        return next;
      });
    });

    socket.auth = { token: getAccessToken(), organizationId };
    socket.connect();

    return () => {
      for (const deviceId of subscribedRef.current) {
        socket.emit("unsubscribe", { deviceId });
      }
      subscribedRef.current.clear();
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, deviceIds.join(",")]);

  return { positionMap };
}
