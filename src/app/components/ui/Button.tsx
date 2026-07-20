"use client";

import type { CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Botón del kit (components/forms/Button.jsx): alto 44px vía minHeight,
// radio sm, pesos 400/500.
export function KitButton({
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = true,
  children,
  onClick,
  type = "button",
  accent,
}: {
  variant?: Variant;
  size?: "sm" | "md";
  disabled?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  accent?: string; // override del fondo primary (p. ej. acento del tipo de transacción)
}) {
  const base: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
    fontSize: size === "sm" ? "var(--text-caption)" : "var(--text-body)",
    borderRadius: "var(--radius-sm)",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    padding: size === "sm" ? "0 14px" : "0 20px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "var(--control-h)",
    width: fullWidth ? "100%" : "auto",
    transition:
      "background-color var(--duration-fast) var(--ease-standard), opacity var(--duration-fast)",
  };

  const variants: Record<Variant, CSSProperties> = {
    primary: { background: accent ?? "var(--accent-strong)", color: "#ffffff" },
    secondary: {
      background: "transparent",
      color: "var(--text)",
      border: "var(--border-width) solid var(--border)",
    },
    ghost: { background: "transparent", color: "var(--accent-strong)" },
    danger: { background: "var(--negative)", color: "#ffffff" },
  };

  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}
