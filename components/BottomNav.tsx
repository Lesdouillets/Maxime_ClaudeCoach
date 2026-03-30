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
        <rect
          x="3" y="4" width="18" height="18" rx="2"
          stroke={active ? "#39ff14" : "#555"}
          strokeWidth="1.8"
        />
        <path
          d="M3 9H21M8 2V6M16 2V6"
          stroke={active ? "#39ff14" : "#555"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M8 13H8.01M12 13H12.01M16 13H16.01M8 17H8.01M12 17H12.01"
          stroke={active ? "#39ff14" : "#555"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/log/fitness",
    label: "Log",
    icon: (active: boolean) => (
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center -mt-5 shadow-lg"
        style={{
          background: active
            ? "linear-gradient(135deg, #39ff14, #1a7a09)"
            : "linear-gradient(135deg, #ff6b00, #7a3300)",
          boxShadow: active
            ? "0 0 20px rgba(57,255,20,0.5)"
            : "0 0 20px rgba(255,107,0,0.5)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5V19M5 12H19"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 20V14M8 20V8M13 20V11M18 20V4"
          stroke={active ? "#39ff14" : "#555"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Profil",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="8" r="4"
          stroke={active ? "#39ff14" : "#555"}
          strokeWidth="1.8"
        />
        <path
          d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20"
          stroke={active ? "#39ff14" : "#555"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid #1a1a1a",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-end justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const isCenter = item.label === "Log";

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 press-effect ${
                isCenter ? "pb-1" : "pt-2"
              }`}
            >
              {item.icon(isActive)}
              {!isCenter && (
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: isActive ? "#39ff14" : "#555" }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
