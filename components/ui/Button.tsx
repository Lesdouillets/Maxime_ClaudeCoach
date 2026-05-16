"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:   "bg-neon text-background font-bold",
  secondary: "bg-surface-2 text-white border border-subtle",
  ghost:     "bg-transparent text-white border border-subtle",
  danger:    "bg-error/10 text-error border border-error/30",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-2 rounded-xl",
  md: "text-sm px-4 py-3 rounded-2xl",
  lg: "text-base px-5 py-4 rounded-2xl",
};

export default function Button({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center press-effect
        transition-opacity duration-150
        disabled:opacity-40 disabled:pointer-events-none
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
