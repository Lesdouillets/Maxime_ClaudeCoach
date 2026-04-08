"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { syncFull } from "@/lib/sync";
import { ensureProfilesExist, getActiveProfileId } from "@/lib/profiles";

export default function SyncProvider() {
  useEffect(() => {
    // Sync au premier chargement si déjà authentifié
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      await syncFull();
      await ensureProfilesExist(session.user.id);
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

    function subscribeRealtime(userId: string, profileId: string) {
      if (channel) supabase.removeChannel(channel);
      channel = supabase
        .channel(`app_changes_${profileId}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `user_id=eq.${userId}`,
        }, () => { syncFull(); })
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "coach_plans",
          filter: `user_id=eq.${userId}`,
        }, () => { syncFull(); })
        .subscribe();
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const profileId = getActiveProfileId();
      if (profileId) subscribeRealtime(user.id, profileId);
    });

    // Re-subscribe when profile switches
    const onProfileSwitch = (e: Event) => {
      const { profileId } = (e as CustomEvent<{ slot: number; profileId: string }>).detail;
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user && profileId) subscribeRealtime(user.id, profileId);
      });
    };
    window.addEventListener("cc:profileSwitch", onProfileSwitch);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("cc:profileSwitch", onProfileSwitch);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
