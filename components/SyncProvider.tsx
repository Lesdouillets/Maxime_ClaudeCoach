"use client";

import { useEffect } from "react";
import { autoSyncPull } from "@/lib/sync";

/** Runs a silent pull from cloud on every page load. */
export default function SyncProvider() {
  useEffect(() => {
    autoSyncPull();
  }, []);
  return null;
}
