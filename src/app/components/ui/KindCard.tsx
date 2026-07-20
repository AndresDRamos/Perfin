"use client";

import type { CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { accentSoftBg, accentStrongFg, type Accent } from "./kit";

// Tarjeta de selección de tipo (kit KindCard): ícono + etiqueta, borde acento
// y fondo pastel cuando está seleccionada.
export function KindCard({
  icon,
  label,
  selected = false,
  accent = "green",
  onClick,
}: {
  icon: string;
  label: string;
  selected?: boolean;
  accent?: Accent;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 88,
        borderRadius: "var(--radius-md)",
        border: `2px solid ${selected ? "var(--accent-strong)" : "var(--border)"}`,
        background: selected ? accentSoftBg(accent) : "transparent",
        padding: 12,
        cursor: "pointer",
        transition: "border-color var(--duration-fast), background-color var(--duration-fast)",
      }}
    >
      <Icon icon={icon} style={{ color: accentStrongFg(accent), fontSize: 28 }} />
      <span
        style={{
          fontSize: "var(--text-caption)",
          fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
          fontFamily: "var(--font-sans)",
          color: selected ? accentStrongFg(accent) : "var(--text)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
