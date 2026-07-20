"use client";

import { useState, type CSSProperties, type MouseEvent } from "react";
import { Icon } from "@iconify/react";
import { IconBadge } from "./IconBadge";
import type { Accent } from "./kit";

// Fila de transacción compacta compartida por las filas expandibles y la vista
// completa de transacciones.
export interface KitTx {
  id: number;
  concepto: string;
  fechaLabel: string; // "8 Jul"
  fechaKey: string; // "2026-07-08"
  amountLabel: string; // "−$1,200.00"
  amountAbs?: number; // magnitud en pesos, para el filtro de montos
  positive?: boolean;
  negative?: boolean; // pinta el monto en rojo en la vista completa
  projected?: boolean;
  meta?: { icon: string; accent: Accent; label: string };
}

export interface RowAction {
  label: string;
  icon: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

interface SharedProps {
  transactions?: KitTx[];
  onTransactionClick?: (t: KitTx, e: MouseEvent<HTMLElement>) => void;
  viewAction?: RowAction;
  actions?: RowAction[];
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

interface AccountVariant extends SharedProps {
  variant?: "account";
  icon: string;
  accent?: Accent;
  title: string;
  subtitle?: string;
  amount?: string;
  negative?: boolean;
}

interface BudgetVariant extends SharedProps {
  variant: "budget";
  label: string;
  current: number;
  target: number;
  currentLabel: string;
  targetLabel: string;
}

type Props = AccountVariant | BudgetVariant;

const actionBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 36,
  width: 36,
  border: "var(--border-width) solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  borderRadius: "var(--radius-full)",
  cursor: "pointer",
  padding: 0,
};

// ExpandableRow (kit) — una entrada expandible cuyo encabezado colapsado es una
// fila estilo cuenta (ícono + nombre + monto) o una barra de presupuesto
// (etiqueta + barra con % dentro). El panel expandido (fondo elevado, borde,
// últimas transacciones, barra de acciones) es compartido.
export function ExpandableRow(props: Props) {
  const {
    transactions = [],
    onTransactionClick,
    viewAction,
    actions = [],
    defaultExpanded = false,
    expanded,
    onToggle,
  } = props;
  const [internalOpen, setInternalOpen] = useState(defaultExpanded);
  const controlled = expanded !== undefined;
  const open = controlled ? expanded : internalOpen;
  const toggle = () => (controlled ? onToggle && onToggle() : setInternalOpen((o) => !o));

  const hasTx = transactions.length > 0;
  const showView = !!viewAction;
  const expandable = hasTx || actions.length > 0 || !!viewAction;

  let header: React.ReactNode;
  if (props.variant === "budget") {
    const { label, current, target, currentLabel, targetLabel } = props;
    const pct = target > 0 ? current / target : 0;
    const over = pct > 1;
    const pctLabel = Math.round(pct * 100);
    const fillWidth = `${Math.max(Math.min(pctLabel, 100), 14)}%`;
    header = (
      <div
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={expandable ? () => toggle() : undefined}
        onKeyDown={
          expandable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle();
                }
              }
            : undefined
        }
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "12px",
          cursor: expandable ? "pointer" : "default",
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
            {label}
          </span>
          <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
            {currentLabel} / {targetLabel}
          </span>
        </div>
        <div
          style={{
            height: 18,
            borderRadius: "var(--radius-full)",
            background: "var(--surface-muted)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: "var(--radius-full)",
              width: fillWidth,
              background: over ? "var(--negative)" : "var(--accent)",
              transition: "width var(--duration-normal) var(--ease-standard)",
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
  } else {
    const { icon, accent = "green", title, subtitle, amount, negative } = props;
    header = (
      <button
        type="button"
        onClick={() => (expandable ? toggle() : undefined)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          width: "100%",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "transparent",
          padding: "12px 16px",
          textAlign: "left",
          cursor: expandable ? "pointer" : "default",
          boxSizing: "border-box",
          color: "var(--text)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {icon && <IconBadge icon={icon} accent={accent} />}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </p>
            {subtitle && (
              <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>{subtitle}</p>
            )}
          </div>
        </div>
        {amount && (
          <p
            style={{
              margin: 0,
              flexShrink: 0,
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
              fontVariantNumeric: "tabular-nums",
              color: negative ? "var(--negative)" : "var(--text)",
            }}
          >
            {amount}
          </p>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        background: open ? "var(--surface-raised)" : "transparent",
        border: `var(--border-width) solid ${open ? "var(--border)" : "transparent"}`,
        transition:
          "background-color var(--duration-normal) var(--ease-standard), border-color var(--duration-normal) var(--ease-standard)",
      }}
    >
      {header}

      {expandable && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: open ? "1fr" : "0fr",
            transition: "grid-template-rows 340ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: "0 12px 12px",
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0)" : "translateY(-4px)",
                transition: "opacity 300ms ease 60ms, transform 300ms ease 60ms",
              }}
            >
              {(showView || actions.length > 0) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  {showView && (
                    <button
                      type="button"
                      aria-label={viewAction.label}
                      title={viewAction.label}
                      style={actionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        viewAction.onClick?.(e);
                      }}
                    >
                      <Icon icon={viewAction.icon} style={{ fontSize: 16 }} />
                    </button>
                  )}
                  <div style={{ display: "flex", gap: 8, flex: showView ? "0 0 auto" : "1 1 auto" }}>
                    {actions.map((act) => (
                      <button
                        key={act.label}
                        type="button"
                        aria-label={act.label}
                        title={act.label}
                        style={{ ...actionBtn, ...(showView ? null : { flex: 1, width: "auto" }) }}
                        onClick={(e) => {
                          e.stopPropagation();
                          act.onClick?.(e);
                        }}
                      >
                        <Icon icon={act.icon} style={{ fontSize: 16 }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasTx && <div style={{ height: "var(--border-width)", background: "var(--border)" }} />}

              {hasTx && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {transactions.map((t) => (
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--surface-muted)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        cursor: "pointer",
                        borderRadius: "var(--radius-sm)",
                        padding: "6px 8px",
                        transition: "background-color 140ms ease",
                        outline: "none",
                      }}
                    >
                      <span style={{ fontSize: "var(--text-caption)", color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.concepto}
                        <span style={{ color: "var(--text-muted)" }}>
                          {" "}
                          · {t.fechaLabel}
                          {t.projected ? " · proyectado" : ""}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-caption)",
                          fontVariantNumeric: "tabular-nums",
                          flexShrink: 0,
                          color: t.positive ? "var(--accent-strong)" : "var(--text)",
                        }}
                      >
                        {t.amountLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
