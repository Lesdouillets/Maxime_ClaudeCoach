"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { syncFull } from "@/lib/sync";

export default function SyncProvider() {
  useEffect(() => {
    // Sync on first load if already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) syncFull();
    });

    // Re-sync every time the app comes back to the foreground.
    // iOS fires visibilitychange when the user switches back to the PWA —
    // this ensures changes from another device appear within seconds.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) syncFull();
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Realtime: sync automatically when another device pushes data
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel("user_data_changes")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "user_data", filter: `user_id=eq.${user.id}` },
          () => { syncFull(); }
        )
        .subscribe();
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
