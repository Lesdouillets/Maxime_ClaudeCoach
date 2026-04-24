"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ACTIVE = "#0A84FF";
const INACTIVE = "rgba(235,235,245,0.35)";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
          fill={active ? ACTIVE : "none"}
          stroke={active ? ACTIVE : INACTIVE}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="3"
          fill={active ? `${ACTIVE}22` : "none"}
          stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.6" />
        <path d="M3 9H21M8 2V6M16 2V6"
          stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 13H8.01M12 13H12.01M16 13H16.01M8 17H8.01M12 17H12.01"
          stroke={active ? ACTIVE : INACTIVE} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="14" width="4" height="6" rx="1"
          fill={active ? ACTIVE : INACTIVE} opacity={active ? 1 : 0.5} />
        <rect x="10" y="9" width="4" height="11" rx="1"
          fill={active ? ACTIVE : INACTIVE} opacity={active ? 1 : 0.7} />
        <rect x="17" y="4" width="4" height="16" rx="1"
          fill={active ? ACTIVE : INACTIVE} />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Profil",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4"
          fill={active ? `${ACTIVE}33` : "none"}
          stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.6" />
        <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8"
          stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          fill={active ? `${ACTIVE}22` : "none"}
          stroke={active ? ACTIVE : INACTIVE}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    setActivating(pathname);
    const t = setTimeout(() => setActivating(null), 350);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      <nav
        style={{
          background: "rgba(18,18,18,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const isActivating = activating === item.href;
            const color = isActive ? ACTIVE : INACTIVE;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 press-effect"
                style={{
                  animation: isActivating ? "nav-activate 0.35s ease-out" : undefined,
                }}
              >
                {item.icon(isActive)}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 400,
                    color,
                    letterSpacing: "0.01em",
                    lineHeight: 1,
                    fontFamily: "var(--font-outfit)",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
