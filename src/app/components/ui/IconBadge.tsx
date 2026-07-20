"use client";

import { Icon } from "@iconify/react";
import { accentSoftBg, accentStrongFg, type Accent } from "./kit";

// Círculo pastel con glifo (kit IconBadge): fondo acento-100, ícono acento-700
// — mismo tratamiento en light y dark.
export function IconBadge({
  icon,
  accent = "green",
  size = 36,
  iconSize = 18,
}: {
  icon: string;
  accent?: Accent;
  size?: number;
  iconSize?: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        background: accentSoftBg(accent),
        flexShrink: 0,
      }}
    >
      <Icon icon={icon} style={{ color: accentStrongFg(accent), fontSize: iconSize }} />
    </span>
  );
}
