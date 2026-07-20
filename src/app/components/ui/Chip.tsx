"use client";

import type { CSSProperties, ReactNode } from "react";

// Chip de selección (kit forms/Chip): pastilla 36px, activa = acento sólido.
export function Chip({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        minHeight: 36,
        borderRadius: "var(--radius-full)",
        border: `var(--border-width) solid ${active ? "var(--accent-strong)" : "var(--border)"}`,
        background: active ? "var(--accent-strong)" : "transparent",
        color: active ? "#ffffff" : "var(--text)",
        fontSize: "var(--text-caption)",
        fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        transition:
          "background-color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast), color var(--duration-fast)",
      }}
    >
      {children}
    </button>
  );
}
