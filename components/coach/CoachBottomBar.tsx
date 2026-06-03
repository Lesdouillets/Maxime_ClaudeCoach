"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SessionStrip, ACTIVE, MUTED } from "@/components/BottomNav";
import CoachInputBar from "@/components/coach/CoachInputBar";
import type { CompressedImage } from "@/lib/imageCompressor";

interface Props {
  value: string;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSend: (image?: CompressedImage | null) => void;
}

export default function CoachBottomBar({ value, sending, textareaRef, onChange, onSend }: Props) {
  const pathname = usePathname();
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    setActivating(pathname);
    const t = setTimeout(() => setActivating(null), 400);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div
      style={{
        position: "fixed",
        left: 0, right: 0, bottom: 0,
        zIndex: 49,
        paddingTop: "48px",
        background: "linear-gradient(to bottom, transparent 0%, var(--color-background) 35%)",
      }}
    >
      <CoachInputBar
        value={value}
        sending={sending}
        textareaRef={textareaRef}
        onChange={onChange}
        onSend={onSend}
      />
      <SessionStrip />
      <nav
        className="flex items-center justify-around px-2 pt-3"
        style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="flex flex-col items-center gap-0.5 press-effect"
              style={{
                animation: activating === item.href ? "nav-activate 0.35s ease-out" : undefined,
              }}
            >
              {item.icon(isActive)}
              <span
                className="text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ color: isActive ? ACTIVE : MUTED }}
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
