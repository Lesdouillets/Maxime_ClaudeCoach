"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRunSheet } from "@/contexts/RunSheetContext";

/**
 * Thin route: the run logging UI now lives in a global sheet (RunSheet).
 * If somebody lands here directly (deep-link, refresh), we open the sheet
 * for the requested date and bounce the user back to home so the sheet
 * appears over the home page.
 */
export default function LogRun() {
  const router = useRouter();
  const runSheet = useRunSheet();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const date = params.get("date");
    runSheet.open(date, { originRoute: "/" });
    router.replace("/");
  }, [router, runSheet]);

  return null;
}
