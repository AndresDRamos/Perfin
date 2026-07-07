"use client";

import { ReactNode } from "react";

// Shared UI atoms for the dashboard. Money formatting mirrors domain/money
// format() but takes pesos (the serialized unit of the dashboard payload).
export function formatMXN(pesos: number) {
  return pesos.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export const inputClass =
  "mt-1 w-full rounded border px-3 py-2 text-sm bg-transparent";
export const labelClass =
  "block text-sm font-medium text-secondary-600 dark:text-secondary-300";
export const primaryButtonClass =
  "w-full rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50";
export const chipButtonClass = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-sm ${
    active
      ? "bg-primary-600 text-white"
      : "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-200"
  }`;

// Bottom-sheet style modal: full-width on mobile, comfortable tap targets,
// closes on backdrop tap.
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4 text-text sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-secondary-600 dark:text-secondary-300"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
