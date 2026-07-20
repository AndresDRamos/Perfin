"use client";

import { useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { editEntry, reconcileEntry } from "@/app/actions/ledger";
import type { AccountCardView, EntryView } from "@/app/actions/dashboard";
import { MorphModal, type MorphClose } from "@/app/components/ui/MorphModal";
import { ModalSelect } from "@/app/components/ui/ModalSelect";
import { MiniCalendar } from "@/app/components/ui/MiniCalendar";
import {
  EASE_MORPH,
  formatMontoInput,
  montoInputToPesos,
  pesosToMontoInput,
  shortDateLabel,
  type OriginRect,
} from "@/app/components/ui/kit";
import { KitButton } from "@/app/components/ui/Button";

interface Props {
  origin: OriginRect;
  onClose: () => void;
  entry: EntryView;
  accounts: AccountCardView[];
  incomeCategories: { id: number; name: string }[];
  expenseCategories: { id: number; name: string }[];
  topInset?: number;
}

// Detalle de transacción (kit TransactionDetailModal.jsx) sobre editEntry:
// monto héroe con el tratamiento del alta; el lápiz del encabezado alterna la
// edición en sitio (monto, concepto, fecha, cuenta/categoría — o, en
// transferencias, cuenta origen/destino) sin saltos de layout. Las
// proyecciones ofrecen "Confirmar" (reconcile).
export function TransactionDetailModal({
  origin,
  onClose,
  entry,
  accounts,
  incomeCategories,
  expenseCategories,
  topInset = 0,
}: Props) {
  const isTransfer = entry.kind === "transfer";
  const positive = entry.kind === "income";
  const amountColor = isTransfer ? "var(--text)" : positive ? "var(--accent-strong)" : "var(--negative)";
  const heroTint = `color-mix(in srgb, ${isTransfer ? "var(--color-indigo-400)" : amountColor} 14%, transparent)`;
  const heroIcon = isTransfer ? "mdi:swap-horizontal" : positive ? "mdi:arrow-bottom-left" : "mdi:arrow-top-right";
  const softLine = `color-mix(in srgb, ${isTransfer ? "var(--color-indigo-400)" : amountColor} 34%, var(--border))`;

  const [editing, setEditing] = useState(false);
  const [monto, setMonto] = useState(pesosToMontoInput(entry.amountPesos));
  const [concepto, setConcepto] = useState(entry.concept ?? "");
  const [fechaKey, setFechaKey] = useState(entry.date);
  const [accountId, setAccountId] = useState(entry.accountId);
  // Solo relevante para transferencias (pago/liquidación entre cuentas
  // propias); en income/expense queda sin usar.
  const [toAccountId, setToAccountId] = useState(entry.toAccountId ?? entry.accountId);
  const [categoryId, setCategoryId] = useState<number | "">(entry.categoryId ?? "");
  const [amtFocus, setAmtFocus] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calRect, setCalRect] = useState<DOMRect | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fechaBtnRef = useRef<HTMLButtonElement | null>(null);

  const categories = entry.kind === "income" ? incomeCategories : expenseCategories;

  async function save(): Promise<boolean> {
    setPending(true);
    setError(null);
    const base = {
      amountPesos: montoInputToPesos(monto),
      concept: concepto || undefined,
      occurredAt: fechaKey,
      status: entry.status,
    };
    const raw = isTransfer
      ? { kind: "transfer", ...base, accountId, toAccountId }
      : {
          kind: entry.kind,
          ...base,
          accountId,
          categoryId: categoryId === "" ? undefined : categoryId,
        };
    const res = await editEntry(entry.id, raw);
    setPending(false);
    if (!res.ok) {
      const first = res.errors ? Object.values(res.errors).flat()[0] : null;
      setError(first ?? "No se pudo guardar el cambio");
      return false;
    }
    return true;
  }

  async function confirmProjection(close: MorphClose) {
    setPending(true);
    await reconcileEntry(entry.id);
    setPending(false);
    close("success");
  }

  function openCal() {
    if (fechaBtnRef.current) setCalRect(fechaBtnRef.current.getBoundingClientRect());
    setCalOpen((o) => !o);
  }

  const detailRow: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "13px 0",
    borderBottom: "var(--border-width) solid var(--border)",
  };
  const editField: CSSProperties = {
    border: "none",
    background: "transparent",
    color: "var(--text)",
    padding: 0,
    fontSize: "var(--text-body)",
    fontFamily: "var(--font-sans)",
    textAlign: "right",
    outline: "none",
    minWidth: 0,
    maxWidth: "62%",
    boxSizing: "border-box",
  };
  const valueSpan: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: "var(--text-body)",
    color: "var(--text)",
    fontVariantNumeric: "tabular-nums",
  };
  const heroSize = 40;

  const CAL_H = 300;
  const calFlip = calRect ? window.innerHeight - calRect.bottom - 6 < CAL_H && calRect.top - 6 > CAL_H : false;
  const calYM = { y: parseInt(fechaKey.slice(0, 4), 10), m: parseInt(fechaKey.slice(5, 7), 10) - 1 };

  const acctName = accounts.find((a) => a.id === accountId)?.name ?? entry.accountName;
  const toAcctName = accounts.find((a) => a.id === toAccountId)?.name ?? entry.toAccountName ?? "";
  const catName =
    categoryId === "" ? "Sin categoría" : (categories.find((c) => c.id === categoryId)?.name ?? entry.categoryName ?? "");

  interface Row {
    label: string;
    value: string;
    icon?: string;
    edit?: "date" | "text" | "account" | "toAccount" | "category";
  }
  const rows: Row[] = [
    { label: "Fecha", value: shortDateLabel(fechaKey), edit: "date" },
    { label: "Concepto", value: concepto || "—", edit: "text" },
    ...(isTransfer
      ? ([
          { label: "Origen", value: acctName, icon: "mdi:bank", edit: "account" },
          { label: "Destino", value: toAcctName, icon: "mdi:bank", edit: "toAccount" },
        ] as Row[])
      : ([
          { label: "Cuenta", value: acctName, icon: "mdi:bank", edit: "account" },
          { label: "Categoría", value: catName, icon: "mdi:tag-outline", edit: "category" },
        ] as Row[])),
    { label: "Estado", value: entry.status === "projected" ? "Proyectado" : "Confirmado" },
  ];

  const kindLabel = isTransfer ? "Transferencia" : positive ? "Ingreso" : "Gasto";

  return (
    <MorphModal
      origin={origin}
      onClose={onClose}
      title="Detalle"
      accent={isTransfer ? "var(--color-indigo-400)" : amountColor}
      glyph="mdi:receipt-text-outline"
      height={entry.status === "projected" ? 560 : 500}
      successMessage="Cambios guardados"
      topInset={topInset}
      actions={[
        {
          icon: editing ? "mdi:check" : "mdi:pencil-outline",
          label: editing ? "Guardar" : "Editar",
          onClick: (close) => {
            if (!editing) {
              setEditing(true);
              return;
            }
            void save().then((ok) => {
              if (ok) close("success");
            });
          },
        },
      ]}
    >
      {(close) => (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", scrollbarWidth: "none", flex: 1 }}>
            {/* Monto héroe */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 8,
                padding: "4px 0 18px",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "var(--radius-full)",
                  background: heroTint,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: amountColor,
                }}
              >
                <Icon icon={heroIcon} style={{ fontSize: 24 }} />
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${editing && amtFocus ? amountColor : softLine}`,
                  transition: `border-color 220ms ${EASE_MORPH}`,
                }}
              >
                <span
                  style={{
                    fontSize: heroSize * 0.52,
                    color: amountColor,
                    fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                    lineHeight: 1,
                  }}
                >
                  $
                </span>
                {editing ? (
                  <input
                    value={monto}
                    onChange={(e) => setMonto(formatMontoInput(e.target.value))}
                    inputMode="numeric"
                    placeholder="0.00"
                    size={Math.max(monto.length, 4)}
                    onFocus={() => setAmtFocus(true)}
                    onBlur={() => setAmtFocus(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      textAlign: "center",
                      fontSize: heroSize,
                      fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                      color: amountColor,
                      fontFamily: "var(--font-sans)",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1.1,
                      padding: 0,
                      minWidth: 0,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: heroSize,
                      fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                      color: amountColor,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1.1,
                    }}
                  >
                    {monto}
                  </span>
                )}
                <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>MXN</span>
              </div>
              <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>{kindLabel}</span>
            </div>

            {/* Lista de detalle */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.map((r, i) => (
                <div key={r.label} style={{ ...detailRow, borderBottom: i === rows.length - 1 ? "none" : detailRow.borderBottom }}>
                  <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>{r.label}</span>
                  {r.edit === "text" && editing ? (
                    <input
                      value={concepto}
                      onChange={(e) => setConcepto(e.target.value)}
                      maxLength={200}
                      size={Math.max(concepto.length, 6)}
                      style={editField}
                    />
                  ) : r.edit === "date" && editing ? (
                    <button
                      ref={fechaBtnRef}
                      type="button"
                      onClick={openCal}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--text)",
                        fontSize: "var(--text-body)",
                        fontFamily: "var(--font-sans)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span>{r.value}</span>
                      <Icon
                        icon="mdi:chevron-down"
                        style={{
                          fontSize: 14,
                          color: "var(--text-muted)",
                          transform: calOpen ? "rotate(180deg)" : "none",
                          transition: "transform 160ms ease",
                        }}
                      />
                    </button>
                  ) : r.edit === "account" && editing ? (
                    <div style={{ maxWidth: "62%", flex: 1 }}>
                      <ModalSelect
                        value={String(accountId)}
                        onChange={(v) => setAccountId(Number(v))}
                        accent={amountColor}
                        options={accounts
                          .filter((a) => !isTransfer || a.id !== toAccountId)
                          .map((a) => ({ value: String(a.id), label: a.name }))}
                      />
                    </div>
                  ) : r.edit === "toAccount" && editing ? (
                    <div style={{ maxWidth: "62%", flex: 1 }}>
                      <ModalSelect
                        value={String(toAccountId)}
                        onChange={(v) => setToAccountId(Number(v))}
                        accent={amountColor}
                        options={accounts
                          .filter((a) => a.id !== accountId)
                          .map((a) => ({ value: String(a.id), label: a.name }))}
                      />
                    </div>
                  ) : r.edit === "category" && editing ? (
                    <div style={{ maxWidth: "62%", flex: 1 }}>
                      <ModalSelect
                        value={categoryId === "" ? "" : String(categoryId)}
                        onChange={(v) => setCategoryId(v === "" ? "" : Number(v))}
                        accent={amountColor}
                        options={[
                          { value: "", label: "Sin categoría" },
                          ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                        ]}
                      />
                    </div>
                  ) : (
                    <span style={valueSpan}>
                      {r.icon && <Icon icon={r.icon} style={{ fontSize: 15, color: "var(--text-muted)" }} />}
                      {r.value}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <p style={{ margin: "10px 0 0", fontSize: "var(--text-caption)", color: "var(--negative)" }}>{error}</p>
            )}
          </div>

          {entry.status === "projected" && (
            <div style={{ paddingTop: 14 }}>
              <KitButton onClick={() => void confirmProjection(close)} disabled={pending}>
                {pending ? "Guardando…" : "Confirmar movimiento"}
              </KitButton>
            </div>
          )}

          {/* El calendario se portalea a <body>: la superficie del modal recorta overflow. */}
          {calOpen &&
            calRect &&
            createPortal(
              <div
                style={{
                  position: "fixed",
                  zIndex: 1000,
                  left: Math.max(8, Math.min(calRect.right - 232, window.innerWidth - 232 - 8)),
                  top: calFlip ? undefined : calRect.bottom + 6,
                  bottom: calFlip ? window.innerHeight - calRect.top + 6 : undefined,
                }}
              >
                <MiniCalendar
                  value={fechaKey}
                  onChange={(v) => {
                    const key = typeof v === "object" && v ? v.start : v;
                    if (key) setFechaKey(key);
                    setCalOpen(false);
                  }}
                  onClose={() => setCalOpen(false)}
                  accent={amountColor}
                  initialY={calYM.y}
                  initialM={calYM.m}
                  triggerRef={fechaBtnRef}
                  allowRange={false}
                />
              </div>,
              document.body
            )}
        </div>
      )}
    </MorphModal>
  );
}
