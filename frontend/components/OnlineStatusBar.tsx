"use client";

import type { OnlineStatus } from "@/hooks/useOnlineStatus";

type OnlineStatusBarProps = {
  status: OnlineStatus;
};

const LABELS: Record<OnlineStatus, string> = {
  checking: "Checking…",
  online: "Online",
  offline: "Offline",
};

export default function OnlineStatusBar({ status }: OnlineStatusBarProps) {
  return (
    <div
      className={`online-status-bar online-status-bar--${status}`}
      title={
        status === "offline"
          ? "Online multiplayer unavailable"
          : status === "online"
            ? "Online multiplayer available"
            : "Checking server status"
      }
      aria-live="polite"
    >
      <span className="online-status-dot" aria-hidden />
      <span className="online-status-label">{LABELS[status]}</span>
    </div>
  );
}
