"use client";
import { useEffect } from "react";
import { syncFull, isSyncConfigured } from "@/lib/sync";

export default function SyncProvider() {
  useEffect(() => {
    // Sync on first load
    if (isSyncConfigured()) syncFull();

    // Re-sync every time the app comes back to the foreground.
    // iOS fires visibilitychange when the user switches back to the PWA —
    // this ensures changes from another device appear within seconds.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && isSyncConfigured()) {
        syncFull();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return null;
}
