"use client";

// Online multiplayer deferred — backend health polling disabled for now.
// import { useCallback, useEffect, useState } from "react";
// import { fetchHealth, type HealthResponse } from "@/game/network/api";

export type OnlineStatus = "checking" | "online" | "offline";

// const POLL_INTERVAL_MS = 30_000;
// const HEALTH_TIMEOUT_MS = 5_000;

export function useOnlineStatus() {
  // const [status, setStatus] = useState<OnlineStatus>("checking");
  // const [health, setHealth] = useState<HealthResponse | null>(null);

  // const check = useCallback(async () => {
  //   const controller = new AbortController();
  //   const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  //   try {
  //     const result = await fetchHealth(controller.signal);
  //     setHealth(result);
  //     setStatus(result.online_multiplayer_available ? "online" : "offline");
  //   } catch {
  //     setHealth(null);
  //     setStatus("offline");
  //   } finally {
  //     window.clearTimeout(timeout);
  //   }
  // }, []);

  // useEffect(() => {
  //   void check();

  //   const handleVisibility = () => {
  //     if (!document.hidden) {
  //       void check();
  //     }
  //   };

  //   document.addEventListener("visibilitychange", handleVisibility);
  //   const interval = window.setInterval(() => {
  //     if (!document.hidden) {
  //       void check();
  //     }
  //   }, POLL_INTERVAL_MS);

  //   return () => {
  //     document.removeEventListener("visibilitychange", handleVisibility);
  //     window.clearInterval(interval);
  //   };
  // }, [check]);

  // return { status, health, refresh: check };
  return {
    status: "offline" as OnlineStatus,
    health: null,
    refresh: async () => {},
  };
}
