"use client";

import { useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const MAIN_PAGES = ["/", "/plan", "/stats", "/settings"];

export default function SwipeNavWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep pathname ref fresh without re-running the touch effect
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
        // Clearly horizontal — prevent scroll so the swipe can complete
        e.preventDefault();
      } else if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx)) {
        // Clearly vertical — user is scrolling, abort swipe tracking
        isTracking = false;
      }
    };

    const onEnd = () => {
      if (!isTracking) return;
      isTracking = false;
      const dx = curX - startX;
      const dy = curY - startY;
      const elapsed = Date.now() - startTime;
      // Navigate if: fast enough, enough horizontal distance, more horizontal than vertical
      if (elapsed > 600 || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 0.8) return;
      const idx = MAIN_PAGES.indexOf(pathnameRef.current);
      if (idx === -1) return;
      if (dx < 0 && idx < MAIN_PAGES.length - 1) router.push(MAIN_PAGES[idx + 1]);
      else if (dx > 0 && idx > 0) router.push(MAIN_PAGES[idx - 1]);
    };

    // touchmove must be non-passive to allow e.preventDefault()
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {children}
    </div>
  );
}
