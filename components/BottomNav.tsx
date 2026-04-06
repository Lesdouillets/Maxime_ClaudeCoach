"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
          stroke={active ? "#39ff14" : "#555"}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill={active ? "rgba(57,255,20,0.1)" : "none"}
        />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2"
          stroke={active ? "#39ff14" : "#555"} strokeWidth="1.8" />
        <path d="M3 9H21M8 2V6M16 2V6"
          stroke={active ? "#39ff14" : "#555"} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 13H8.01M12 13H12.01M16 13H16.01M8 17H8.01M12 17H12.01"
          stroke={active ? "#39ff14" : "#555"} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 20V14M8 20V8M13 20V11M18 20V4"
          stroke={active ? "#39ff14" : "#555"} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Sync",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 12v-1a8 8 0 0 1 14.93-3M20 12v1a8 8 0 0 1-14.93 3"
          stroke={active ? "#39ff14" : "#555"} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M20 4v4h-4M4 20v-4h4"
          stroke={active ? "#39ff14" : "#555"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <nav
        className="flex items-center pointer-events-auto"
        style={{
          background: "rgba(10,10,10,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "9999px",
          padding: "8px 12px",
          gap: "4px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center press-effect"
              style={{
                padding: "8px 18px",
                borderRadius: "9999px",
                background: isActive ? "rgba(57,255,20,0.08)" : "transparent",
                minWidth: "64px",
              }}
            >
              {item.icon(isActive)}
              <span
                className="text-[10px] font-medium tracking-wide mt-0.5"
                style={{ color: isActive ? "#39ff14" : "#555" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
