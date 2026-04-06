"use client";

import { useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const MAIN_PAGES = ["/", "/plan", "/stats", "/settings"];

export default function SwipeNavWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    let startX = 0, startY = 0, startTime = 0;
    let curX = 0, curY = 0;
    let isTracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = curX = e.touches[0].clientX;
      startY = curY = e.touches[0].clientY;
      startTime = Date.now();
      isTracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!isTracking || e.touches.length !== 1) return;
      curX = e.touches[0].clientX;
      curY = e.touches[0].clientY;
      const dx = curX - startX;
      const dy = curY - startY;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 2) {
        // Horizontal intent confirmed — block scroll only on main pages
        if (MAIN_PAGES.includes(pathnameRef.current)) e.preventDefault();
      } else if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx)) {
        isTracking = false; // vertical intent → abort
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!isTracking) return;
      isTracking = false;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;
      const elapsed = Date.now() - startTime;
      if (elapsed > 600 || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 0.8) return;
      const idx = MAIN_PAGES.indexOf(pathnameRef.current);
      if (idx === -1) return;
      if (dx < 0 && idx < MAIN_PAGES.length - 1) router.push(MAIN_PAGES[idx + 1]);
      else if (dx > 0 && idx > 0) router.push(MAIN_PAGES[idx - 1]);
    };

    // Attach to document: fires regardless of which element the touch started on.
    // touchmove must be non-passive to allow e.preventDefault() (blocks scroll during horizontal swipe).
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return <>{children}</>;
}
