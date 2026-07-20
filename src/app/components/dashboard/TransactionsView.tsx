"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Icon } from "@iconify/react";
import { MiniCalendar, type DateSel } from "@/app/components/ui/MiniCalendar";
import { ModalSelect } from "@/app/components/ui/ModalSelect";
import type { KitTx, RowAction } from "@/app/components/ui/ExpandableRow";
import {
  EASE_MORPH,
  accentSoftBg,
  accentStrongFg,
  fuzzyMatch,
  modalField,
  partsFromKey,
  shortDateLabel,
  type Accent,
  type OriginRect,
} from "@/app/components/ui/kit";

export interface TxViewProgress {
  label: string;
  current: number;
  target: number;
  currentLabel: string;
  targetLabel: string;
}

interface Props {
  origin: OriginRect;
  frame: { left: number; width: number };
  icon?: string;
  accent?: Accent;
  title: string;
  total?: string;
  totalNegative?: boolean;
  columnLabel: string; // "Categoría" (vista de cuenta) o "Banco" (vista de presupuesto)
  progress?: TxViewProgress;
  transactions: KitTx[];
  actions?: RowAction[];
  topInset?: number;
  onTransactionClick?: (t: KitTx, e: MouseEvent<HTMLElement>) => void;
  onClose: () => void;
}

function dateSelLabel(sel: DateSel): string {
  if (!sel) return "Todas";
  if (typeof sel === "object") {
    return sel.start === sel.end
      ? shortDateLabel(sel.start)
      : `${shortDateLabel(sel.start)} – ${shortDateLabel(sel.end)}`;
  }
  return shortDateLabel(sel);
}

// Vista de transacciones con container-transform (kit TransactionsScreen.jsx):
// el encabezado de la fila tocada se desliza intacto hasta el tope de la
// columna y la lista completa aparece debajo; tocarlo de nuevo revierte el
// morph y regresa al dashboard.
export function TransactionsView({
  origin,
  frame,
  icon,
  accent = "green",
  title,
  total,
  totalNegative = false,
  columnLabel,
  progress,
  transactions,
  actions = [],
  topInset = 0,
  onTransactionClick,
  onClose,
}: Props) {
  const [reduce] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catSel, setCatSel] = useState("");
  const [dateSel, setDateSel] = useState<DateSel>("");
  const [calOpen, setCalOpen] = useState(false);
  const [amtMin, setAmtMin] = useState("");
  const [amtMax, setAmtMax] = useState("");
  const dateBtnRef = useRef<HTMLButtonElement | null>(null);

  const HEADER_H = origin.height;
  const ACTIONS_H = 44;
  const DUR = reduce ? 1 : 480;
  const REVEAL = reduce ? 1 : 320;

  // setTimeout (no rAF): dispara aun sin frames de pintura (pestaña en
  // segundo plano) — el estilo inicial ya está aplicado cuando corre.
  useEffect(() => {
    const id = window.setTimeout(() => setOpen(true), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    setOpen(false);
    if (reduce) {
      window.setTimeout(onClose, 1);
      return;
    }
    // La columna sigue cubierta durante todo el morph del encabezado; el
    // dashboard se revela solo cuando el encabezado volvió a su fila.
    window.setTimeout(() => setRevealing(true), DUR);
    window.setTimeout(onClose, DUR + REVEAL);
  }

  const headerStyle: CSSProperties = {
    left: origin.left,
    width: origin.width,
    height: origin.height,
    top: open ? topInset : origin.top,
    background: "var(--surface)",
    borderRadius: 0,
  };

  // Encabezado de barra de progreso reutilizado tal cual (solo se desplaza).
  const progressHeader = (pad: string) => {
    if (!progress) return null;
    const pct = progress.target > 0 ? progress.current / progress.target : 0;
    const over = pct > 1;
    const pctLabel = Math.round(pct * 100);
    const fillWidth = `${Math.max(Math.min(pctLabel, 100), 14)}%`;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: pad,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: "var(--text-caption)",
          }}
        >
          <span style={{ fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"], color: "var(--text)" }}>
            {progress.label}
          </span>
          <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
            {progress.currentLabel} / {progress.targetLabel}
          </span>
        </div>
        <div style={{ height: 18, borderRadius: "var(--radius-full)", background: "var(--surface-muted)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: "var(--radius-full)",
              width: fillWidth,
              background: over ? "var(--negative)" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 8,
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-caption)",
                fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                color: "#FFFFFF",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {pctLabel}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Opciones de filtro presentes en los datos + días con movimientos (puntos
  // del mini calendario).
  const filterMetas = useMemo(
    () => [...new Map(transactions.filter((t) => t.meta).map((t) => [t.meta!.label, t.meta!])).values()],
    [transactions]
  );
  const txDateKeys = useMemo(() => new Set(transactions.map((t) => t.fechaKey)), [transactions]);
  const today = new Date();
  const dateSelKey = dateSel ? (typeof dateSel === "object" ? dateSel.start : dateSel) : null;
  const calInitial = dateSelKey
    ? { y: parseInt(dateSelKey.slice(0, 4), 10), m: parseInt(dateSelKey.slice(5, 7), 10) - 1 }
    : { y: today.getFullYear(), m: today.getMonth() };

  const minV = amtMin === "" ? null : parseFloat(amtMin);
  const maxV = amtMax === "" ? null : parseFloat(amtMax);
  const anyFilter = !!(query || catSel || dateSel || amtMin !== "" || amtMax !== "");
  const activeCount = [query, catSel, dateSel, amtMin !== "" || amtMax !== ""].filter(Boolean).length;

  const rows = transactions.filter((t) => {
    if (!fuzzyMatch(query, t.concepto)) return false;
    if (catSel && !(t.meta && t.meta.label === catSel)) return false;
    if (dateSel) {
      const k = t.fechaKey;
      if (typeof dateSel === "object") {
        if (!k || k < dateSel.start || k > dateSel.end) return false;
      } else if (k !== dateSel) return false;
    }
    const amt = t.amountAbs ?? 0;
    if (minV != null && !Number.isNaN(minV) && amt < minV) return false;
    if (maxV != null && !Number.isNaN(maxV) && amt > maxV) return false;
    return true;
  });

  const clearFilters = () => {
    setQuery("");
    setCatSel("");
    setDateSel("");
    setAmtMin("");
    setAmtMax("");
  };

  const headerIconBtn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    padding: 0,
    border: "var(--border-width) solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    borderRadius: "var(--radius-full)",
    cursor: "pointer",
  };

  const fInput: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    background: "transparent",
    color: "var(--text)",
    fontSize: "var(--text-caption)",
    fontFamily: "var(--font-sans)",
    outline: "none",
    padding: 0,
    minWidth: 0,
  };
  const fFieldWrap: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
    padding: "7px 10px",
    borderRadius: "var(--radius-sm)",
    border: "var(--border-width) solid var(--border)",
    background: "var(--surface)",
  };
  const fDateBtn: CSSProperties = {
    ...modalField,
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    cursor: "pointer",
    textAlign: "left",
    borderColor: calOpen ? "var(--accent-strong)" : "var(--border)",
  };
  const fMiniLabel: CSSProperties = {
    display: "block",
    fontSize: "var(--text-caption)",
    lineHeight: 1.2,
    color: "var(--text-muted)",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  };
  const fAmt: CSSProperties = { ...fInput, width: 64, textAlign: "center" };
  const fAmtWrap: CSSProperties = { ...fFieldWrap, flex: "none", width: 76, padding: "7px 8px", justifyContent: "center" };

  const fadeInOnOpen: CSSProperties = {
    opacity: open ? 1 : 0,
    transition: `opacity ${Math.round(DUR * 0.4)}ms ${EASE_MORPH} ${open ? Math.round(DUR * 0.45) : 0}ms`,
  };

  return (
    <div style={{ position: "fixed", top: topInset, left: 0, right: 0, bottom: 0, zIndex: 40, pointerEvents: "auto" }}>
      {/* Cobertura completa de la columna. */}
      <div
        style={{
          position: "fixed",
          left: frame.left,
          top: topInset,
          width: frame.width,
          height: `calc(100vh - ${topInset}px)`,
          background: "var(--surface)",
          opacity: closing ? (revealing ? 0 : 1) : open ? 1 : 0,
          transition: `opacity ${closing ? REVEAL : Math.round(DUR * 0.5)}ms ${EASE_MORPH}`,
        }}
      />

      {/* Lista scrolleable bajo el encabezado fijo (+ barra de acciones). */}
      <div
        style={{
          position: "fixed",
          left: frame.left,
          top: topInset + HEADER_H + ACTIONS_H,
          width: frame.width,
          bottom: 0,
          overflowY: "auto",
          scrollbarWidth: "none",
          boxSizing: "border-box",
          padding: "16px 20px 40px",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(14px)",
          transition: `opacity ${Math.round(DUR * 0.55)}ms ${EASE_MORPH} ${open ? Math.round(DUR * 0.34) : 0}ms, transform ${Math.round(DUR * 0.55)}ms ${EASE_MORPH} ${open ? Math.round(DUR * 0.34) : 0}ms`,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* La misma hairline que la tarjeta dibuja sobre sus transacciones. */}
        <div style={{ height: "var(--border-width)", background: "var(--border)", marginBottom: 6 }} />

        {rows.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "48px 0",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            <Icon icon="mdi:receipt-text-outline" style={{ fontSize: 34 }} />
            <p style={{ margin: 0, fontSize: "var(--text-caption)" }}>
              {anyFilter ? "Sin transacciones con estos filtros" : "Sin transacciones registradas"}
            </p>
          </div>
        )}

        {/* Fila: columna de fecha fija (día de semana + día / mes), descripción
            + badge cruzado, y monto. Tocar abre el detalle con morph. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {rows.map((t, i) => {
            const revealDelay = open ? Math.round(DUR * 0.4) + Math.min(i, 8) * 36 : 0;
            const d = partsFromKey(t.fechaKey);
            const hoverOn = (e: MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
              (e.currentTarget as HTMLElement).style.background = "var(--surface-muted)";
            };
            const hoverOff = (e: MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            };
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={(e) => onTransactionClick && onTransactionClick(t, e)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && onTransactionClick) {
                    e.preventDefault();
                    onTransactionClick(t, e as unknown as MouseEvent<HTMLElement>);
                  }
                }}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
                onFocus={hoverOn}
                onBlur={hoverOff}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 8px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  outline: "none",
                  opacity: open ? 1 : 0,
                  transform: open ? "translateY(0)" : "translateY(8px)",
                  transitionProperty: "opacity, transform, background-color",
                  transitionDuration: `${Math.round(DUR * 0.5)}ms, ${Math.round(DUR * 0.5)}ms, 130ms`,
                  transitionTimingFunction: `${EASE_MORPH}, ${EASE_MORPH}, ease`,
                  transitionDelay: `${revealDelay}ms, ${revealDelay}ms, 0ms`,
                }}
              >
                <div style={{ width: 48, flexShrink: 0, display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span
                    style={{
                      fontSize: "var(--text-caption)",
                      fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                      color: "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {d.weekday ? `${d.weekday}, ${d.day}` : d.day}
                  </span>
                  <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>{d.monthLabel}</span>
                </div>

                <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <span
                    style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.concepto}
                    {t.projected && <span style={{ color: "var(--text-muted)" }}> · proyectado</span>}
                  </span>
                  {t.meta && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        alignSelf: "flex-start",
                        padding: "2px 8px 2px 6px",
                        borderRadius: "var(--radius-full)",
                        background: accentSoftBg(t.meta.accent),
                        color: accentStrongFg(t.meta.accent),
                        fontSize: "var(--text-caption)",
                        fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                        maxWidth: "100%",
                      }}
                    >
                      <Icon icon={t.meta.icon} style={{ fontSize: 12, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.meta.label}
                      </span>
                    </span>
                  )}
                </div>

                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                    fontVariantNumeric: "tabular-nums",
                    color: t.positive ? "var(--accent-strong)" : t.negative ? "var(--negative)" : "var(--text)",
                  }}
                >
                  {t.amountLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Encabezado morph — clic en cualquier parte regresa al dashboard. */}
      <button
        type="button"
        onClick={close}
        aria-label="Volver al panel"
        style={{
          position: "fixed",
          overflow: "hidden",
          zIndex: 41,
          border: "none",
          textAlign: "left",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          transition: `top ${DUR}ms ${EASE_MORPH}`,
          ...headerStyle,
        }}
      >
        {progress ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {progressHeader("10px 12px")}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "12px 16px",
              pointerEvents: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {icon && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-full)",
                    background: accentSoftBg(accent),
                    flexShrink: 0,
                  }}
                >
                  <Icon icon={icon} style={{ color: accentStrongFg(accent), fontSize: 18 }} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {title}
                </p>
              </div>
            </div>
            {total && (
              <p
                style={{
                  margin: 0,
                  flexShrink: 0,
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                  fontVariantNumeric: "tabular-nums",
                  color: totalNegative ? "var(--negative)" : "var(--text)",
                }}
              >
                {total}
              </p>
            )}
          </div>
        )}
      </button>

      {/* Barra de acciones bajo el encabezado: filtro a la izquierda, acciones
          (editar / nueva transacción) a la derecha. */}
      <div
        style={{
          position: "fixed",
          left: frame.left,
          top: topInset + HEADER_H,
          width: frame.width,
          height: ACTIONS_H,
          zIndex: 42,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 20px",
          boxSizing: "border-box",
          ...fadeInOnOpen,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <button
          type="button"
          aria-label="Filtros"
          title="Filtros"
          aria-expanded={filtersOpen}
          style={{
            ...headerIconBtn,
            position: "relative",
            background: filtersOpen ? "var(--surface-muted)" : "transparent",
            borderColor: activeCount ? "var(--accent-strong)" : "var(--border)",
          }}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <Icon icon={filtersOpen ? "mdi:filter-variant-remove" : "mdi:filter-variant"} style={{ fontSize: 16 }} />
          {activeCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                boxSizing: "border-box",
                borderRadius: "var(--radius-full)",
                background: "var(--accent-strong)",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                lineHeight: "16px",
                textAlign: "center",
              }}
            >
              {activeCount}
            </span>
          )}
        </button>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {actions.map((act) => (
            <button
              key={act.label}
              type="button"
              aria-label={act.label}
              title={act.label}
              style={headerIconBtn}
              onClick={(e) => act.onClick && act.onClick(e)}
            >
              <Icon icon={act.icon} style={{ fontSize: 16 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Panel flotante de filtros. */}
      <div
        style={{
          position: "fixed",
          left: frame.left + 12,
          top: topInset + HEADER_H + ACTIONS_H + 8,
          width: frame.width - 24,
          zIndex: 43,
          background: "var(--surface-raised)",
          boxSizing: "border-box",
          borderRadius: "var(--radius-md)",
          border: "var(--border-width) solid var(--border)",
          boxShadow: "var(--shadow-overlay)",
          opacity: filtersOpen && open ? 1 : 0,
          transform: filtersOpen && open ? "translateY(0) scale(1)" : "translateY(-6px) scale(0.98)",
          transformOrigin: "top right",
          transition: `opacity 180ms ${EASE_MORPH}, transform 180ms ${EASE_MORPH}`,
          pointerEvents: filtersOpen && open ? "auto" : "none",
        }}
      >
        <div style={{ padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Búsqueda aproximada por concepto. */}
          <div style={{ ...fFieldWrap, transition: "border-color 160ms ease" }}>
            <Icon icon="mdi:magnify" style={{ fontSize: 16, color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.borderColor = "var(--accent-strong)";
              }}
              onBlur={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.borderColor = "var(--border)";
              }}
              placeholder="Buscar concepto (aproximado)…"
              style={fInput}
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <Icon icon="mdi:close-circle" style={{ fontSize: 15 }} />
              </button>
            )}
          </div>

          {/* Badge cruzado (categoría ↔ cuenta) + fecha. */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={fMiniLabel}>{columnLabel}</label>
              <ModalSelect
                value={catSel}
                onChange={setCatSel}
                accent="var(--accent-strong)"
                options={[{ value: "", label: "Todas" }, ...filterMetas.map((m) => ({ value: m.label, label: m.label }))]}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
              <label style={fMiniLabel}>Fecha</label>
              <button ref={dateBtnRef} type="button" onClick={() => setCalOpen((o) => !o)} style={fDateBtn}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                  <Icon icon="mdi:calendar-blank-outline" style={{ fontSize: 14, flexShrink: 0, color: "var(--text-muted)" }} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: dateSel ? "var(--text)" : "var(--text-muted)",
                    }}
                  >
                    {dateSelLabel(dateSel)}
                  </span>
                </span>
                <Icon
                  icon="mdi:chevron-down"
                  style={{
                    fontSize: 14,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    transform: calOpen ? "rotate(180deg)" : "none",
                    transition: "transform 160ms ease",
                  }}
                />
              </button>
              {calOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50 }}>
                  <MiniCalendar
                    value={dateSel}
                    onChange={setDateSel}
                    onClose={() => setCalOpen(false)}
                    accent="var(--accent-strong)"
                    initialY={calInitial.y}
                    initialM={calInitial.m}
                    txKeys={txDateKeys}
                    triggerRef={dateBtnRef}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Rango de montos. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)", flexShrink: 0 }}>Monto</span>
            <div style={fAmtWrap}>
              <input type="number" inputMode="numeric" value={amtMin} onChange={(e) => setAmtMin(e.target.value)} placeholder="mín" style={fAmt} />
            </div>
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>–</span>
            <div style={fAmtWrap}>
              <input type="number" inputMode="numeric" value={amtMax} onChange={(e) => setAmtMax(e.target.value)} placeholder="máx" style={fAmt} />
            </div>
            {anyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  marginLeft: "auto",
                  flexShrink: 0,
                  border: "none",
                  background: "none",
                  padding: "4px 2px",
                  cursor: "pointer",
                  color: "var(--accent-strong)",
                  fontSize: "var(--text-caption)",
                  fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                  fontFamily: "var(--font-sans)",
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
