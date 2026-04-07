"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { syncFull } from "@/lib/sync";

export default function SyncProvider() {
  useEffect(() => {
    // Sync au premier chargement si déjà authentifié
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) syncFull();
    });

    // Re-sync quand l'app revient au premier plan (iOS PWA : visibilitychange)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) syncFull();
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Realtime : sync instantanée quand un autre appareil insère/modifie une session
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel("app_changes")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `user_id=eq.${user.id}`,
        }, () => { syncFull(); })
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "coach_plans",
          filter: `user_id=eq.${user.id}`,
        }, () => { syncFull(); })
        .subscribe();
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
