"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import type { EntryView } from "@/app/actions/dashboard";
import { MiniCalendar } from "@/app/components/ui/MiniCalendar";
import { humanDateLabel, rectOf, type OriginRect } from "@/app/components/ui/kit";
import { signedPesosForAccount } from "./entry-kit";
import { formatMXN } from "./ui";

interface Point {
  date: string;
  balancePesos: number;
}

interface Props {
  series: Point[];
  today: string;
  entriesByDay: Record<string, EntryView[]>;
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
  // (+) del panel de día: pasado → transacción, futuro → proyección.
  onAddAtDay: (date: string, origin: OriginRect) => void;
  onEntryClick?: (entry: EntryView, e: MouseEvent<HTMLElement>) => void;
  onConfigureIncome?: () => void;
}

// Línea de tiempo del saldo (kit BalanceTimeline.jsx sobre la serie real):
// franja scrolleable con 11px/día, curva suave con gradiente, línea "hoy"
// punteada en rojo, límites de mes y panel de día seleccionado con captura
// contextual. La serie y la proyección vienen del dominio (domain/timeline).
const PPD = 11;
const PAD = { t: 16, r: 16, b: 36, l: 16 };
const H = 150;
const INGRESO_COLOR = "#22c55e";
const GASTO_FIJO_COLOR = "#a855f7";

function keyToUTC(key: string): Date {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

export function BalanceTimeline({
  series,
  today,
  entriesByDay,
  selectedDate,
  onSelect,
  onAddAtDay,
  onEntryClick,
  onConfigureIncome,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const calBtnRef = useRef<HTMLButtonElement | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calRect, setCalRect] = useState<DOMRect | null>(null);
  const drag = useRef({ down: false, moved: 0, startX: 0, startScroll: 0 });

  const n = series.length;
  const plotW = Math.max(n - 1, 1) * PPD;
  const W = plotW + PAD.l + PAD.r;
  const todayIdx = Math.max(
    series.findIndex((p) => p.date === today),
    0
  );

  const idxOf = (date: string) => series.findIndex((p) => p.date === date);
  const px = (i: number) => PAD.l + i * PPD;

  const { py, coords } = useMemo(() => {
    const vals = series.map((p) => p.balancePesos);
    const minY = Math.min(...vals);
    const maxY = Math.max(...vals);
    const py = (b: number) => PAD.t + (1 - (b - minY) / (maxY - minY || 1)) * (H - PAD.t - PAD.b);
    return { py, coords: series.map((p, i) => ({ x: px(i), y: py(p.balancePesos) })) };
  }, [series]);

  // Curva suave (Catmull-Rom → bezier, tensión 0.6 como el kit).
  const line = useMemo(() => {
    const pts = coords;
    if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
    const T = 0.6;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + ((p2.x - p0.x) / 6) * T;
      const c1y = p1.y + ((p2.y - p0.y) / 6) * T;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * T;
      const c2y = p2.y - ((p3.y - p1.y) / 6) * T;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  }, [coords]);

  const area = coords.length
    ? `${line} L ${coords[coords.length - 1].x} ${H - PAD.b} L ${coords[0].x} ${H - PAD.b} Z`
    : "";
  const todayX = px(todayIdx);

  // Ticks cada 5 días y límites/etiquetas de mes.
  const ticks = useMemo(() => series.map((_, i) => i).filter((i) => i % 5 === 0), [series]);
  const { monthLines, monthLabels } = useMemo(() => {
    const boundaries = [0];
    for (let i = 1; i < n; i++) {
      if (series[i].date.slice(8, 10) === "01") boundaries.push(i);
    }
    const monthLines = boundaries.slice(1);
    const monthLabels = boundaries.map((b, i) => {
      const end = i < boundaries.length - 1 ? boundaries[i + 1] : n;
      const d = keyToUTC(series[b].date);
      const name = d.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }).replace(".", "");
      return { name, x: px((b + end - 1) / 2) };
    });
    return { monthLines, monthLabels };
  }, [series, n]);

  // Días con marcador: ingreso → verde; gasto proyectado/fijo → morado.
  const markerColor = (date: string): string | null => {
    const list = entriesByDay[date];
    if (!list || list.length === 0) return null;
    if (list.some((e) => e.kind === "income")) return INGRESO_COLOR;
    if (list.some((e) => e.kind === "expense" && e.status === "projected")) return GASTO_FIJO_COLOR;
    return null;
  };
  const eventDays = useMemo(
    () => series.map((p) => p.date).filter((d) => markerColor(d) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, entriesByDay]
  );
  const txKeys = useMemo(() => new Set(Object.keys(entriesByDay)), [entriesByDay]);

  // El panel conserva el último día activo para que el colapso no vacíe el
  // contenido a mitad de la animación.
  // (patrón "derivar del render anterior": set-state guardado durante render)
  const [lastShown, setLastShown] = useState<string | null>(null);
  if (selectedDate != null && selectedDate !== lastShown) {
    setLastShown(selectedDate);
  }
  const shown = selectedDate ?? lastShown;
  const isPast = shown != null && shown <= today;
  const dayEntries = shown != null ? (entriesByDay[shown] ?? []) : [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = todayX - 120;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectDay(date: string) {
    setCalOpen(false);
    onSelect(selectedDate === date ? null : date);
  }

  function pickDate(key: string) {
    if (!key) return;
    // Clava la selección dentro del rango graficado y la trae a la vista.
    const clamped = key < series[0].date ? series[0].date : key > series[n - 1].date ? series[n - 1].date : key;
    onSelect(clamped);
    setCalOpen(false);
    window.setTimeout(() => {
      const i = idxOf(clamped);
      if (scrollRef.current && i >= 0) scrollRef.current.scrollLeft = px(i) - 120;
    }, 0);
  }

  function onPlotClick(e: MouseEvent<SVGSVGElement>) {
    if (drag.current.moved > 6) return; // fue un arrastre, no un tap
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round((x - PAD.l) / PPD);
    i = Math.max(0, Math.min(n - 1, i));
    selectDay(series[i].date);
  }
  function onDown(e: React.PointerEvent) {
    const s = scrollRef.current!;
    drag.current = { down: true, moved: 0, startX: e.clientX, startScroll: s.scrollLeft };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
    scrollRef.current!.scrollLeft = drag.current.startScroll - dx;
  }
  function onUp() {
    drag.current.down = false;
  }

  function openAdd(e: MouseEvent<HTMLButtonElement>) {
    if (shown == null) return;
    setCalOpen(false);
    onAddAtDay(shown, rectOf(e.currentTarget));
  }

  const bulletColor = (e: EntryView): string => {
    if (e.kind === "income") return INGRESO_COLOR;
    if (e.kind === "transfer") return "var(--color-indigo-400)";
    return e.status === "projected" ? GASTO_FIJO_COLOR : "var(--color-mustard-500)";
  };

  const activeIdx = selectedDate != null ? idxOf(selectedDate) : -1;
  const calYM = shown
    ? { y: parseInt(shown.slice(0, 4), 10), m: parseInt(shown.slice(5, 7), 10) - 1 }
    : { y: parseInt(today.slice(0, 4), 10), m: parseInt(today.slice(5, 7), 10) - 1 };

  return (
    <div>
      <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>
        Saldo · desliza para ver más
      </span>

      <div
        ref={scrollRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        style={{
          margin: "4px -16px 0",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          touchAction: "pan-x",
          cursor: "grab",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)",
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} onClick={onPlotClick} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-strong)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--accent-strong)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#balFill)" />
          <path d={line} fill="none" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          <line x1={todayX} y1={PAD.t - 6} x2={todayX} y2={H - PAD.b} stroke="var(--negative)" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx={todayX} cy={py(series[todayIdx]?.balancePesos ?? 0)} r="5" fill="var(--negative)" stroke="var(--surface)" strokeWidth="2" />

          {monthLines.map((i) => (
            <line key={`ml${i}`} x1={px(i)} y1={PAD.t - 6} x2={px(i)} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />
          ))}

          {ticks.map((i) => (
            <text
              key={i}
              x={px(i)}
              y={H - PAD.b + 14}
              textAnchor="middle"
              fill={series[i].date === today ? "var(--negative)" : "var(--text-muted)"}
              fontSize="9"
              style={{ fontVariantNumeric: "tabular-nums" }}
              fontFamily="var(--font-sans)"
            >
              {Number(series[i].date.slice(8, 10))}
            </text>
          ))}

          {monthLabels.map((m, i) => (
            <text
              key={`mlbl${i}`}
              x={m.x}
              y={H - PAD.b + 27}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="9"
              fontWeight="600"
              fontFamily="var(--font-sans)"
              style={{ textTransform: "capitalize" }}
            >
              {m.name}
            </text>
          ))}

          {/* guía del día seleccionado + punto hueco (aunque no haya evento) */}
          {activeIdx >= 0 && (
            <g>
              <line x1={px(activeIdx)} y1={PAD.t - 6} x2={px(activeIdx)} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />
              {eventDays.indexOf(series[activeIdx].date) === -1 && (
                <circle cx={px(activeIdx)} cy={py(series[activeIdx].balancePesos)} r="5" fill="var(--surface)" stroke="var(--text-muted)" strokeWidth="2" />
              )}
            </g>
          )}

          {eventDays.map((d) => {
            const i = idxOf(d);
            if (i < 0) return null;
            const isActive = selectedDate === d;
            return (
              <circle
                key={d}
                cx={px(i)}
                cy={py(series[i].balancePesos)}
                r={isActive ? 6 : 4.5}
                fill={markerColor(d) ?? "var(--text-muted)"}
                stroke="var(--surface)"
                strokeWidth="2"
                style={{ pointerEvents: "none" }}
              />
            );
          })}
        </svg>
      </div>

      {/* Panel del día seleccionado */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: selectedDate != null ? "1fr" : "0fr",
          transition: "grid-template-rows 340ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              opacity: selectedDate != null ? 1 : 0,
              transform: selectedDate != null ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 300ms ease 60ms, transform 300ms ease 60ms",
            }}
          >
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: "var(--text-body)", textTransform: "capitalize", fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"] }}>
                {shown != null ? humanDateLabel(shown) : ""}
              </strong>
              <button
                ref={calBtnRef}
                type="button"
                aria-label="Cambiar fecha"
                title="Cambiar fecha"
                onClick={() => {
                  if (calOpen) {
                    setCalOpen(false);
                    return;
                  }
                  if (calBtnRef.current) setCalRect(calBtnRef.current.getBoundingClientRect());
                  setCalOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  border: "none",
                  padding: 0,
                  background: "transparent",
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  color: calOpen ? "var(--text)" : "var(--text-muted)",
                }}
              >
                <Icon icon="mdi:calendar-blank-outline" style={{ fontSize: 16 }} />
              </button>

              <span style={{ flex: 1 }} />

              {onConfigureIncome && (
                <button
                  type="button"
                  onClick={onConfigureIncome}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "3px 4px",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: "var(--text-caption)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Ingreso recurrente
                </button>
              )}

              {/* Mismo (+) circular que los encabezados de Cuentas/Presupuestos. */}
              <button
                type="button"
                onClick={openAdd}
                aria-label={isPast ? "Nueva transacción" : "Nueva proyección"}
                title={isPast ? "Nueva transacción" : "Nueva proyección"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                  padding: 6,
                  border: "var(--border-width) solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  borderRadius: "var(--radius-full)",
                  cursor: "pointer",
                }}
              >
                <Icon icon="mdi:plus" style={{ fontSize: 15 }} />
              </button>

              {calOpen &&
                shown != null &&
                calRect &&
                createPortal(
                  (() => {
                    const CAL_W = 232;
                    const CAL_H = 300;
                    const flip = calRect.bottom + 6 + CAL_H > window.innerHeight;
                    return (
                      <div
                        style={{
                          position: "fixed",
                          zIndex: 1000,
                          left: Math.max(8, Math.min(calRect.left, window.innerWidth - CAL_W - 8)),
                          top: flip ? undefined : calRect.bottom + 6,
                          bottom: flip ? window.innerHeight - calRect.top + 6 : undefined,
                        }}
                      >
                        <MiniCalendar
                          value={dayEntries.length > 0 ? shown : null}
                          onChange={(v) => {
                            const key = typeof v === "object" && v ? v.start : v;
                            pickDate(key);
                          }}
                          onClose={() => setCalOpen(false)}
                          accent="var(--color-indigo-300)"
                          initialY={calYM.y}
                          initialM={calYM.m}
                          txKeys={txKeys}
                          triggerRef={calBtnRef}
                          allowRange={false}
                        />
                      </div>
                    );
                  })(),
                  document.body
                )}
            </div>

            {dayEntries.length > 0 ? (
              dayEntries.map((e) => {
                const signed = signedPesosForAccount(e, e.accountId);
                const isIncome = e.kind === "income";
                return (
                  <div
                    key={e.id}
                    role={onEntryClick ? "button" : undefined}
                    tabIndex={onEntryClick ? 0 : undefined}
                    onClick={(ev) => onEntryClick && onEntryClick(e, ev)}
                    onKeyDown={(ev) => {
                      if ((ev.key === "Enter" || ev.key === " ") && onEntryClick) {
                        ev.preventDefault();
                        onEntryClick(e, ev as unknown as MouseEvent<HTMLElement>);
                      }
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 10, cursor: onEntryClick ? "pointer" : "default", outline: "none" }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: bulletColor(e), flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "var(--text-caption)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.concept || (e.kind === "transfer" ? "Transferencia" : isIncome ? "Ingreso" : "Gasto")}
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}
                        · {e.kind === "transfer" ? `${e.accountName} → ${e.toAccountName}` : e.accountName}
                        {e.status === "projected" ? " · proyectado" : ""}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-caption)",
                        fontVariantNumeric: "tabular-nums",
                        color: isIncome ? "var(--accent-strong)" : "var(--text)",
                        flexShrink: 0,
                      }}
                    >
                      {isIncome ? "+" : "−"}
                      {formatMXN(Math.abs(signed)).replace("-", "")}
                    </span>
                  </div>
                );
              })
            ) : (
              <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>
                Sin movimientos este día.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
