"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { EASE_MORPH, type OriginRect } from "./kit";

export type MorphClose = (mode: "cancel" | "success") => void;

export interface MorphAction {
  icon: string;
  label: string;
  danger?: boolean;
  onClick?: (close: MorphClose) => void;
}

interface Props {
  origin: OriginRect;
  onClose: () => void;
  title: string;
  accent?: string;
  surfaceBg?: string;
  glyph?: string;
  height?: number;
  successMessage?: string;
  actions?: MorphAction[];
  topInset?: number;
  children: ReactNode | ((close: MorphClose) => ReactNode);
}

// Cascarón de modal container-transform (kit MorphModal.jsx): un control
// circular (origin) se expande y transforma en la superficie del modal —
// radio, tamaño y color interpolan juntos para leerse como un solo objeto.
// Al cerrar con éxito, un check dibujado confirma antes de desvanecer.
export function MorphModal({
  origin,
  onClose,
  title,
  accent = "var(--accent-strong)",
  surfaceBg = "var(--surface)",
  glyph = "mdi:plus",
  height = 520,
  successMessage = "Guardado",
  actions = [],
  topInset = 0,
  children,
}: Props) {
  const [reduce] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeMode, setCloseMode] = useState<"cancel" | "success">("cancel");
  const [traceOn, setTraceOn] = useState(false);
  const [fade, setFade] = useState(false);
  const [exit, setExit] = useState(false);

  // Rect destino del modal (coordenadas de viewport), acotado a 390px como la
  // columna móvil del producto.
  const target = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const availH = vh - topInset;
    const frameW = Math.min(390, vw);
    const frameLeft = (vw - frameW) / 2;
    const margin = 16;
    const width = frameW - margin * 2;
    const h = Math.min(height, availH - 48);
    const left = frameLeft + margin;
    const top = topInset + Math.max(24, (availH - h) / 2);
    return { left, top, width, height: h };
  }, [height, topInset]);

  const DUR = reduce ? 1 : 460;
  const FADE = reduce ? 1 : 300;

  function close(mode: "cancel" | "success") {
    if (closing) return;
    const success = mode === "success";
    setCloseMode(success ? "success" : "cancel");
    setClosing(true);
    if (reduce) {
      window.setTimeout(onClose, 1);
      return;
    }
    window.setTimeout(() => setFade(true), 40); // la tarjeta se desvanece
    const hold = success ? 900 : 40; // pausa sobre la confirmación
    window.setTimeout(() => setExit(true), hold);
    window.setTimeout(onClose, hold + FADE);
  }

  // setTimeout (no rAF): dispara aun sin frames de pintura (pestaña en
  // segundo plano) — el estilo inicial ya está aplicado cuando corre.
  useEffect(() => {
    const id = window.setTimeout(() => setExpanded(true), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dispara el trazo del check una vez que `closing` es verdadero.
  useEffect(() => {
    if (!closing || reduce) return;
    const id = window.setTimeout(() => setTraceOn(true), 30);
    return () => window.clearTimeout(id);
  }, [closing, reduce]);

  const surfaceStyle: CSSProperties = expanded
    ? {
        left: target.left,
        top: target.top,
        width: target.width,
        height: target.height,
        borderRadius: 20,
        background: surfaceBg,
        border: "var(--border-width) solid var(--border)",
        boxShadow: "var(--shadow-overlay)",
        opacity: fade ? 0 : 1,
        transform: fade ? "scale(0.96)" : "scale(1)",
      }
    : {
        left: origin.left,
        top: origin.top,
        width: origin.width,
        height: origin.height,
        borderRadius: origin.width,
        background: accent,
        boxShadow: "0 0 0 rgba(0,0,0,0)",
      };

  const contentVisible = expanded && !closing;

  const iconBtn: CSSProperties = {
    border: "none",
    background: "var(--surface-muted)",
    color: "var(--text-muted)",
    width: 32,
    height: 32,
    borderRadius: "var(--radius-full)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  return (
    <div style={{ position: "fixed", top: topInset, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      {/* Scrim */}
      <div
        onClick={() => close("cancel")}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(7,10,9,0.55)",
          opacity: (expanded && !fade) || (closing && closeMode === "success" && !exit) ? 1 : 0,
          transition: `opacity ${DUR}ms ${EASE_MORPH}`,
        }}
      />

      {/* Superficie que se transforma */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          overflow: "hidden",
          transition: `left ${DUR}ms ${EASE_MORPH}, top ${DUR}ms ${EASE_MORPH}, width ${DUR}ms ${EASE_MORPH}, height ${DUR}ms ${EASE_MORPH}, border-radius ${DUR}ms ${EASE_MORPH}, background ${DUR}ms ${EASE_MORPH}, box-shadow ${DUR}ms ${EASE_MORPH}, opacity ${FADE}ms ${EASE_MORPH}, transform ${FADE}ms ${EASE_MORPH}`,
          ...surfaceStyle,
        }}
      >
        {/* Glifo — visible solo colapsado; cruza-fade con el contenido */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            opacity: expanded ? 0 : 1,
            transition: `opacity ${Math.round(DUR * 0.3)}ms ${EASE_MORPH} ${expanded ? 0 : Math.round(DUR * 0.62)}ms`,
            pointerEvents: "none",
          }}
        >
          <Icon icon={glyph} style={{ fontSize: 15 }} />
        </div>

        {/* Contenido del modal */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: "var(--space-5, 20px) 20px 16px",
            boxSizing: "border-box",
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? "translateY(0)" : "translateY(8px)",
            transition: `opacity ${Math.round(DUR * 0.55)}ms ${EASE_MORPH} ${contentVisible ? Math.round(DUR * 0.35) : 0}ms, transform ${Math.round(DUR * 0.55)}ms ${EASE_MORPH} ${contentVisible ? Math.round(DUR * 0.35) : 0}ms`,
            pointerEvents: contentVisible ? "auto" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "var(--text-heading)", fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"] }}>{title}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => a.onClick && a.onClick(close)}
                  aria-label={a.label}
                  title={a.label}
                  style={{ ...iconBtn, color: a.danger ? "var(--negative)" : "var(--text-muted)" }}
                >
                  <Icon icon={a.icon} style={{ fontSize: 17 }} />
                </button>
              ))}
              <button type="button" onClick={() => close("cancel")} aria-label="Cerrar" style={iconBtn}>
                <Icon icon="mdi:close" style={{ fontSize: 18 }} />
              </button>
            </div>
          </div>

          {typeof children === "function" ? children(close) : children}
        </div>
      </div>

      {/* Confirmación de éxito — check dibujado + etiqueta */}
      {closing && closeMode === "success" && (
        <div
          style={{
            position: "fixed",
            left: target.left,
            top: target.top,
            width: target.width,
            height: target.height,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            textAlign: "center",
            padding: 24,
            boxSizing: "border-box",
            pointerEvents: "none",
            opacity: exit ? 0 : traceOn ? 1 : 0,
            transform: traceOn && !exit ? "translateY(0)" : "translateY(8px)",
            transition: `opacity ${FADE}ms ${EASE_MORPH}, transform ${FADE}ms ${EASE_MORPH}`,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "var(--radius-full)",
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12.5 L10 18.5 L20 6.5"
                stroke={accent}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={traceOn ? 0 : 100}
                style={{ transition: `stroke-dashoffset 440ms ${EASE_MORPH} 200ms` }}
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
              color: "var(--text)",
            }}
          >
            {successMessage}
          </div>
        </div>
      )}
    </div>
  );
}
