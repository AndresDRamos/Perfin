"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Icon } from "@iconify/react";
import { DIA_ABR, MES_FULL, dateKeyOf } from "./kit";

export type DateSel = string | { start: string; end: string } | "";

interface Props {
  value: DateSel | null;
  onChange: (value: DateSel) => void;
  onClose: () => void;
  accent?: string;
  initialY: number;
  initialM: number; // 0-based
  txKeys?: Set<string>;
  triggerRef?: RefObject<HTMLElement | null>;
  today?: Date;
  allowRange?: boolean;
}

const navBtn: CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-sm)",
  flexShrink: 0,
};

const linkBtn: CSSProperties = {
  border: "none",
  background: "none",
  padding: "3px 4px",
  cursor: "pointer",
  color: "var(--accent-strong)",
  fontSize: "var(--text-caption)",
  fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
  fontFamily: "var(--font-sans)",
};

// Popover de calendario mensual (kit TransactionsScreen.jsx). Hoy lleva un
// anillo rojo suave; el día seleccionado un anillo del acento del disparador.
// Presionar y arrastrar selecciona un rango (si allowRange); soltar sin mover
// selecciona el día, igual que un clic simple.
export function MiniCalendar({
  value,
  onChange,
  onClose,
  accent = "var(--accent-strong)",
  initialY,
  initialM,
  txKeys,
  triggerRef,
  today: todayProp,
  allowRange = true,
}: Props) {
  const [viewY, setViewY] = useState(initialY);
  const [viewM, setViewM] = useState(initialM);
  const ref = useRef<HTMLDivElement | null>(null);
  const today = todayProp || new Date();

  const [dragAnchor, setDragAnchor] = useState<string | null>(null);
  const [dragCurrent, setDragCurrent] = useState<string | null>(null);
  const dragRef = useRef({ anchor: null as string | null, current: null as string | null, dragging: false, active: false });
  const onChangeRef = useRef(onChange);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onChangeRef.current = onChange;
    onCloseRef.current = onClose;
  });

  function beginDrag(key: string) {
    dragRef.current = { anchor: key, current: key, dragging: false, active: true };
    setDragAnchor(key);
    setDragCurrent(key);
  }
  function enterDay(key: string) {
    if (!dragRef.current.active) return;
    dragRef.current.current = key;
    setDragCurrent(key);
    if (key !== dragRef.current.anchor && !dragRef.current.dragging) {
      dragRef.current.dragging = true;
    }
  }
  function finishDrag() {
    const { anchor, current, dragging, active } = dragRef.current;
    if (!active || !anchor) return;
    dragRef.current.active = false;
    const end = current || anchor;
    if (allowRange && dragging && end !== anchor) {
      const start = anchor < end ? anchor : end;
      const finish = anchor < end ? end : anchor;
      onChangeRef.current({ start, end: finish });
    } else {
      onChangeRef.current(anchor);
    }
    onCloseRef.current();
    setDragAnchor(null);
    setDragCurrent(null);
  }

  useEffect(() => {
    function onUp() {
      finishDrag();
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragRef.current.active) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const dayEl = el && el.closest ? (el.closest("[data-day-key]") as HTMLElement | null) : null;
      if (dayEl) enterDay(dayEl.getAttribute("data-day-key")!);
    }
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchmove", onTouchMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Ignora el clic que abrió/alterna el panel vía su propio botón disparador.
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      if (triggerRef && triggerRef.current && triggerRef.current.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, triggerRef]);

  const firstWeekday = new Date(viewY, viewM, 1).getDay();
  const numDays = new Date(viewY, viewM + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) cells.push(d);

  const keyFor = (d: number) => `${viewY}-${String(viewM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const isToday = (d: number) =>
    today.getFullYear() === viewY && today.getMonth() === viewM && today.getDate() === d;
  const redSoft = "color-mix(in srgb, var(--negative) 55%, transparent)";
  const accentSoft = `color-mix(in srgb, ${accent} 55%, transparent)`;

  const committedRange = value
    ? typeof value === "object"
      ? { start: value.start, end: value.end }
      : { start: value, end: value }
    : null;
  const previewRange = dragAnchor
    ? (() => {
        const cur = dragCurrent || dragAnchor;
        return cur < dragAnchor ? { start: cur, end: dragAnchor } : { start: dragAnchor, end: cur };
      })()
    : null;
  const effRange = previewRange || committedRange;

  function shiftMonth(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewM(m);
    setViewY(y);
  }

  return (
    <div
      ref={ref}
      style={{
        background: "var(--surface-raised)",
        border: "var(--border-width) solid var(--border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-overlay)",
        padding: 10,
        width: 232,
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button type="button" aria-label="Mes anterior" onClick={() => shiftMonth(-1)} style={navBtn}>
          <Icon icon="mdi:chevron-left" style={{ fontSize: 16 }} />
        </button>
        <span
          style={{
            fontSize: "var(--text-caption)",
            fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
            color: "var(--text)",
          }}
        >
          {MES_FULL[viewM]} {viewY}
        </span>
        <button type="button" aria-label="Mes siguiente" onClick={() => shiftMonth(1)} style={navBtn}>
          <Icon icon="mdi:chevron-right" style={{ fontSize: 16 }} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
        {DIA_ABR.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)" }}>
            {d.slice(0, 2)}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, userSelect: "none" }}>
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const key = keyFor(d);
          const isT = isToday(d);
          const inRange = !!(effRange && key >= effRange.start && key <= effRange.end);
          const isEdge = !!(effRange && (key === effRange.start || key === effRange.end));
          const hasTx = txKeys && txKeys.has(key);
          let ring = "none";
          if (isT && isEdge) ring = `0 0 0 1.25px ${redSoft}, 0 0 0 3.25px ${accentSoft}`;
          else if (isT) ring = `0 0 0 1.25px ${redSoft}`;
          else if (isEdge) ring = `0 0 0 1.25px ${accentSoft}`;
          const bg = isEdge
            ? "var(--surface-muted)"
            : inRange
              ? "color-mix(in srgb, var(--accent-strong) 16%, transparent)"
              : "transparent";
          return (
            <button
              key={i}
              type="button"
              data-day-key={key}
              onMouseDown={(e) => {
                e.preventDefault();
                beginDrag(key);
              }}
              onMouseEnter={(e) => {
                enterDay(key);
                if (!isEdge && !inRange) e.currentTarget.style.background = "var(--surface-muted)";
              }}
              onMouseLeave={(e) => {
                if (!isEdge && !inRange) e.currentTarget.style.background = "transparent";
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                beginDrag(key);
              }}
              style={{
                position: "relative",
                width: 28,
                height: 28,
                border: "none",
                background: bg,
                borderRadius: isEdge || !inRange ? "50%" : "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "var(--text-caption)",
                fontFamily: "var(--font-sans)",
                color: "var(--text)",
                fontWeight: (isT || isEdge
                  ? "var(--weight-medium)"
                  : "var(--weight-regular)") as CSSProperties["fontWeight"],
                boxShadow: ring,
                boxSizing: "border-box",
                touchAction: "none",
              }}
            >
              {d}
              {hasTx && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    background: "var(--text-muted)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          paddingTop: 8,
          borderTop: "var(--border-width) solid var(--border)",
        }}
      >
        <button
          type="button"
          style={linkBtn}
          onClick={() => {
            setViewY(today.getFullYear());
            setViewM(today.getMonth());
            onChange(dateKeyOf(today));
            onClose();
          }}
        >
          Hoy
        </button>
        {value && (
          <button
            type="button"
            style={{ ...linkBtn, color: "var(--text-muted)" }}
            onClick={() => {
              onChange("");
              onClose();
            }}
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
