import type { ReactNode } from "react";

interface MenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  color?: string;
}

interface Props {
  onClose: () => void;
  items: MenuItem[];
  width?: number;
  menuClassName?: string;
}

export function ContextMenu({ onClose, items, width = 220, menuClassName = "absolute right-0 top-12" }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-dropdown" onClick={onClose} />
      <div
        className={`${menuClassName} z-dropdown rounded-2xl overflow-hidden animate-fade-in`}
        style={{
          width,
          background: "rgba(28,28,30,0.96)",
          border: "1px solid #2a2a2a",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.6)",
        }}
      >
        {items.map((item, i) => (
          <div key={i}>
            {i > 0 && <div className="border-t border-surface-3" />}
            <button
              onClick={(e) => { e.stopPropagation(); item.onClick(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-surface-2 transition-colors duration-150 press-effect ${
                item.color ? "" : item.variant === "destructive" ? "text-error" : "text-white"
              }`}
              style={item.color ? { color: item.color } : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
