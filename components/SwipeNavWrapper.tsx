"use client";

import { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const MAIN_PAGES = ["/", "/plan", "/stats", "/settings"];

export default function SwipeNavWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;

    // Require: fast (<400ms), horizontal (>60px), more horizontal than vertical
    if (elapsed > 400 || Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    const idx = MAIN_PAGES.indexOf(pathname);
    if (idx === -1) return;

    if (deltaX < 0 && idx < MAIN_PAGES.length - 1) {
      router.push(MAIN_PAGES[idx + 1]);
    } else if (deltaX > 0 && idx > 0) {
      router.push(MAIN_PAGES[idx - 1]);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: "inherit", display: "contents" }}
    >
      {children}
    </div>
  );
}
