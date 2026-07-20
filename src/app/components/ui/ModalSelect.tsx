"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { modalField } from "./kit";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  accent?: string;
  placeholder?: string;
}

// Dropdown estilizado compartido — reemplaza al <select> nativo, cuya lista de
// opciones renderizada por el SO ignora la superficie oscura del tema.
export function ModalSelect({ value, onChange, options, accent = "var(--accent-strong)", placeholder = "" }: Props) {
  const opts: SelectOption[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current && btnRef.current.contains(t)) return;
      if (listRef.current && listRef.current.contains(t)) return;
      setOpen(false);
    };
    const onReflow = () => setOpen(false);
    // Scroll en fase de captura: cierra el dropdown si la página/un ancestro se
    // mueve (el botón cambiaría de posición), pero NO si el scroll ocurre
    // dentro de la propia lista de opciones — si no, desplazarse por las
    // opciones se confunde con un "reflow" externo y el menú se cierra solo.
    const onScroll = (e: Event) => {
      const t = e.target as Node;
      if (listRef.current && listRef.current.contains(t)) return;
      onReflow();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const current = opts.find((o) => o.value === value);

  // La lista se voltea arriba del disparador cuando no hay espacio abajo.
  const MAXH = 220;
  const below = rect ? window.innerHeight - rect.bottom - 8 : MAXH;
  const flip = rect ? below < 160 && rect.top - 8 > below : false;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...modalField,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: "pointer",
          textAlign: "left",
          borderColor: open ? accent : "var(--border)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: current ? "var(--text)" : "var(--text-muted)",
          }}
        >
          {current ? current.label : placeholder}
        </span>
        <Icon
          icon="mdi:chevron-down"
          style={{
            fontSize: 18,
            color: "var(--text-muted)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 160ms ease",
          }}
        />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              left: rect.left,
              width: rect.width,
              zIndex: 1000,
              boxSizing: "border-box",
              top: flip ? undefined : rect.bottom + 4,
              bottom: flip ? window.innerHeight - rect.top + 4 : undefined,
              background: "var(--surface)",
              border: "var(--border-width) solid var(--border)",
              borderRadius: "var(--radius-sm)",
              boxShadow: "var(--shadow-overlay)",
              padding: 4,
              maxHeight: MAXH,
              overflowY: "auto",
              scrollbarWidth: "none",
            }}
          >
            {opts.map((o) => {
              const sel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    if (!sel) e.currentTarget.style.background = "var(--surface-muted)";
                  }}
                  onMouseLeave={(e) => {
                    if (!sel) e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "100%",
                    border: "none",
                    background: sel ? "var(--surface-muted)" : "transparent",
                    color: "var(--text)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "var(--text-body)",
                    fontFamily: "var(--font-sans)",
                    textAlign: "left",
                    minHeight: "var(--tap-target)" as CSSProperties["minHeight"],
                  }}
                >
                  <span>{o.label}</span>
                  {sel && <Icon icon="mdi:check" style={{ fontSize: 16, color: accent, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
