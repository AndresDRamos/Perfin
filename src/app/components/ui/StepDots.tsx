"use client";

// Indicador de pasos del onboarding (kit StepDots): el paso activo se alarga.
export function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          style={{
            height: 8,
            width: n === step ? 24 : 8,
            borderRadius: "var(--radius-full)",
            background: n === step ? "var(--accent-strong)" : "var(--border)",
            transition: "width var(--duration-normal) var(--ease-standard), background-color var(--duration-normal)",
          }}
        />
      ))}
    </div>
  );
}
