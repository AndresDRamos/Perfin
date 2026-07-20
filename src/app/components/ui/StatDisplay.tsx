"use client";

import type { CSSProperties } from "react";

// Cifra héroe centrada (kit StatDisplay.jsx): etiqueta caption en mayúsculas +
// valor display 34px con figuras tabulares.
export function StatDisplay({
  label,
  value,
  negative = false,
  size = "display",
}: {
  label: string;
  value: string;
  negative?: boolean;
  size?: "display" | "heading";
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-caption)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: size === "display" ? "var(--text-display)" : "var(--text-heading)",
          fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
          fontVariantNumeric: "tabular-nums",
          letterSpacing: size === "display" ? "-0.02em" : undefined,
          color: negative ? "var(--negative)" : "var(--text)",
        }}
      >
        {value}
      </p>
    </div>
  );
}
