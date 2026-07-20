"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { captureEntry } from "@/app/actions/ledger";
import type { AccountCardView } from "@/app/actions/dashboard";
import { MorphModal, type MorphClose } from "@/app/components/ui/MorphModal";
import { ModalSelect } from "@/app/components/ui/ModalSelect";
import { MiniCalendar } from "@/app/components/ui/MiniCalendar";
import {
  EASE_MORPH,
  formatMontoInput,
  humanDateLabel,
  modalField,
  modalLabel,
  modalPill,
  montoInputToPesos,
  type OriginRect,
} from "@/app/components/ui/kit";
import { formatMXN } from "./ui";

interface Category {
  id: number;
  name: string;
}

export interface TxPreset {
  accountId?: number; // cuenta fija (abierto desde una fila de cuenta)
  categoryId?: number; // categoría fija (abierto desde un presupuesto)
  kind?: "income" | "expense";
  date?: string; // ISO; default hoy
}

interface ContextPill {
  icon?: string;
  label: string;
  value: string;
}

interface Props {
  origin: OriginRect;
  onClose: () => void;
  accounts: AccountCardView[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  today: string; // ISO — decide transacción (≤hoy, cleared) vs proyección (>hoy, projected)
  preset?: TxPreset;
  context?: ContextPill[];
  title?: string;
  submitLabel?: string;
  successMessage?: string;
  topInset?: number;
}

const GASTO_ACCENT = "#b45309";
const AJUSTE_ACCENT = "var(--color-indigo-400)";

interface TabDef {
  key: "gasto" | "ingreso" | "ajuste";
  label: string;
  accent: string;
  icon: string;
}

// "Nueva transacción" (kit NewTransactionModal.jsx) conectada a captureEntry:
// tabs Gasto/Ingreso pintan la superficie con su acento; monto héroe con
// entrada de centavos; cuenta/categoría como dropdowns estilizados. Reglas
// reales del producto: en crédito un ingreso ES un pago (transferencia desde
// otra cuenta propia, con atajo "liquidar"); en inversión existe "Ajustar"
// (una entry por la diferencia); un ingreso a cash/débito pregunta si viene de
// otra cuenta propia (→ transferencia).
export function NewTransactionModal({
  origin,
  onClose,
  accounts,
  incomeCategories,
  expenseCategories,
  today,
  preset = {},
  context = [],
  title = "Nueva transacción",
  submitLabel,
  successMessage,
  topInset = 0,
}: Props) {
  const target = preset.accountId !== undefined ? accounts.find((a) => a.id === preset.accountId) : undefined;
  const isCredit = target?.kind === "credit";
  const isInvestment = target?.kind === "investment";

  const tabs: TabDef[] = useMemo(() => {
    const gasto: TabDef = {
      key: "gasto",
      label: isCredit ? "Compra" : "Gasto",
      accent: GASTO_ACCENT,
      icon: "mdi:tray-arrow-up",
    };
    const ingreso: TabDef = {
      key: "ingreso",
      label: isCredit ? "Pago" : "Ingreso",
      accent: "var(--accent-strong)",
      icon: "mdi:tray-arrow-down",
    };
    const out = [gasto, ingreso];
    if (isInvestment) out.push({ key: "ajuste", label: "Ajustar", accent: AJUSTE_ACCENT, icon: "mdi:scale-balance" });
    return out;
  }, [isCredit, isInvestment]);

  const [tab, setTab] = useState<TabDef["key"]>(preset.kind === "income" ? "ingreso" : "gasto");
  const [accountId, setAccountId] = useState<number | "">(preset.accountId ?? "");
  const [fromAccountId, setFromAccountId] = useState<number | "">("");
  const [monto, setMonto] = useState("");
  const [newTotal, setNewTotal] = useState("");
  const [concepto, setConcepto] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">(preset.categoryId ?? "");
  const [date, setDate] = useState(preset.date ?? today);
  const [amtFocus, setAmtFocus] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calRect, setCalRect] = useState<DOMRect | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateBtnRef = useRef<HTMLButtonElement | null>(null);

  const effectiveTarget = target ?? accounts.find((a) => a.id === accountId);
  const sourceOptions = accounts.filter((a) => a.id !== effectiveTarget?.id);
  const owed = isCredit && target ? Math.max(-target.balancePesos, 0) : 0;
  const isProjection = date > today;
  const lockAccount = preset.accountId !== undefined;
  const lockCategory = preset.categoryId !== undefined;

  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  const accent = active.accent;
  const idx = tabs.findIndex((t) => t.key === tab);
  const softLine = `color-mix(in srgb, ${accent} 34%, var(--border))`;

  // Un pago de tarjeta o un ingreso "que viene de otra cuenta" es transferencia.
  const isTransfer = tab === "ingreso" && (isCredit || fromAccountId !== "");
  const categories = tab === "ingreso" ? incomeCategories : expenseCategories;

  const valid =
    tab === "ajuste"
      ? newTotal !== ""
      : montoInputToPesos(monto) > 0 && (lockAccount || accountId !== "") && (!isCredit || tab !== "ingreso" || fromAccountId !== "");

  const heroSize = 36;

  const label = modalLabel;
  const field: CSSProperties = { ...modalField, transition: `border-color 200ms ${EASE_MORPH}` };
  const focusA = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = accent.startsWith("var(") ? "var(--accent-strong)" : accent;
  };
  const blurA = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--border)";
  };

  async function submit(close: MorphClose) {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    let raw: Record<string, unknown>;

    if (tab === "ajuste") {
      const total = montoInputToPesos(newTotal);
      const diff = Math.round((total - (effectiveTarget?.balancePesos ?? 0)) * 100) / 100;
      if (Number.isNaN(total) || diff === 0) {
        setError("El nuevo saldo debe ser diferente al actual");
        setPending(false);
        return;
      }
      raw = {
        kind: diff > 0 ? "income" : "expense",
        amountPesos: Math.abs(diff),
        concept: concepto || "Ajuste de saldo",
        occurredAt: date,
        status: "cleared",
        accountId: effectiveTarget!.id,
      };
    } else if (isTransfer) {
      raw = {
        kind: "transfer",
        amountPesos: montoInputToPesos(monto),
        concept: concepto || undefined,
        occurredAt: date,
        status: isProjection ? "projected" : "cleared",
        accountId: fromAccountId,
        toAccountId: effectiveTarget!.id,
      };
    } else {
      raw = {
        kind: tab === "ingreso" ? "income" : "expense",
        amountPesos: montoInputToPesos(monto),
        concept: concepto || undefined,
        occurredAt: date,
        status: isProjection ? "projected" : "cleared",
        accountId: effectiveTarget?.id ?? accountId,
        categoryId: categoryId === "" ? undefined : categoryId,
      };
    }

    const res = await captureEntry(raw);
    setPending(false);
    if (res.ok) {
      close("success");
    } else {
      const first = res.errors ? Object.values(res.errors).flat()[0] : null;
      setError(first ?? "No se pudo guardar el movimiento");
    }
  }

  function openCal() {
    if (dateBtnRef.current) setCalRect(dateBtnRef.current.getBoundingClientRect());
    setCalOpen((o) => !o);
  }

  const calYM = { y: parseInt(date.slice(0, 4), 10), m: parseInt(date.slice(5, 7), 10) - 1 };
  const CAL_H = 300;
  const calFlip = calRect ? window.innerHeight - calRect.bottom - 6 < CAL_H && calRect.top - 6 > CAL_H : false;

  const finalSubmitLabel = submitLabel ?? (isProjection ? "Agregar proyección" : "Registrar transacción");
  const finalSuccess = successMessage ?? (isProjection ? "Proyección guardada" : "Transacción guardada");

  const btnStyle: CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 16px",
    minHeight: "var(--control-h)",
    cursor: valid && !pending ? "pointer" : "not-allowed",
    background: valid ? accent : "var(--surface-muted)",
    color: valid ? "#fff" : "var(--text-muted)",
    fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
    fontSize: "var(--text-body)",
    fontFamily: "var(--font-sans)",
    transition: `background 260ms ${EASE_MORPH}, color 260ms ${EASE_MORPH}`,
  };

  return (
    <MorphModal
      origin={origin}
      onClose={onClose}
      title={title}
      accent={accent}
      successMessage={finalSuccess}
      height={isInvestment ? 600 : 586}
      topInset={topInset}
    >
      {(close) => (
        <>
          {/* Tabs subrayado (config fija del kit: estiloTabs "subrayado") */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ position: "relative", display: "flex", borderBottom: "var(--border-width) solid var(--border)" }}>
              <div
                style={{
                  position: "absolute",
                  bottom: -1,
                  height: 2,
                  left: `${idx * (100 / tabs.length)}%`,
                  width: `${100 / tabs.length}%`,
                  background: accent,
                  borderRadius: 2,
                  transition: `left 300ms ${EASE_MORPH}, background 300ms ${EASE_MORPH}`,
                }}
              />
              {tabs.map((tb) => {
                const on = tab === tb.key;
                return (
                  <button
                    key={tb.key}
                    type="button"
                    onClick={() => setTab(tb.key)}
                    style={{
                      position: "relative",
                      zIndex: 1,
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                      padding: "10px 0",
                      minHeight: "var(--tap-target)" as CSSProperties["minHeight"],
                      color: on ? tb.accent : "var(--text-muted)",
                      fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                      transition: `color 250ms ${EASE_MORPH}`,
                    }}
                  >
                    <Icon icon={tb.icon} style={{ fontSize: 16 }} />
                    {tb.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflowY: "auto",
              flex: 1,
              scrollbarWidth: "none",
            }}
          >
            {context.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {context.map((c, i) => (
                  <span key={i} style={modalPill}>
                    {c.icon && <Icon icon={c.icon} style={{ fontSize: 14, color: "var(--text-muted)" }} />}
                    <span style={{ color: "var(--text-muted)" }}>{c.label}</span>
                    <strong style={{ fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"] }}>{c.value}</strong>
                  </span>
                ))}
              </div>
            )}

            {tab === "ajuste" ? (
              <div>
                <label style={label}>Nuevo saldo total (MXN)</label>
                <input
                  value={newTotal}
                  onChange={(e) => setNewTotal(formatMontoInput(e.target.value))}
                  inputMode="numeric"
                  placeholder={formatMXN(effectiveTarget?.balancePesos ?? 0).replace("$", "")}
                  onFocus={focusA}
                  onBlur={blurA}
                  style={field}
                />
                <p style={{ margin: "6px 0 0", fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>
                  Se registra un ajuste por la diferencia contra el saldo actual (
                  {formatMXN(effectiveTarget?.balancePesos ?? 0)}); el saldo sigue derivado de tus movimientos.
                </p>
              </div>
            ) : (
              <>
                {/* Monto héroe */}
                <div>
                  <label style={label}>Monto (MXN)</label>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 6,
                      width: "100%",
                      borderBottom: `2px solid ${amtFocus ? accent : softLine}`,
                      paddingBottom: 8,
                      transition: `border-color 220ms ${EASE_MORPH}`,
                      boxSizing: "border-box",
                    }}
                  >
                    <span
                      style={{
                        fontSize: heroSize * 0.52,
                        color: accent,
                        fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                        lineHeight: 1,
                      }}
                    >
                      $
                    </span>
                    <input
                      value={monto}
                      onChange={(e) => setMonto(formatMontoInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="0.00"
                      onFocus={() => setAmtFocus(true)}
                      onBlur={() => setAmtFocus(false)}
                      style={{
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        flex: 1,
                        minWidth: 0,
                        fontSize: heroSize,
                        fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                        color: "var(--text)",
                        fontFamily: "var(--font-sans)",
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.1,
                        padding: 0,
                      }}
                    />
                    <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>MXN</span>
                  </div>
                  {isCredit && tab === "ingreso" && owed > 0 && (
                    <button
                      type="button"
                      onClick={() => setMonto(formatMontoInput(String(Math.round(owed * 100))))}
                      style={{
                        marginTop: 8,
                        border: "none",
                        background: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--accent-strong)",
                        fontSize: "var(--text-caption)",
                        fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      Liquidar por completo ({formatMXN(owed)})
                    </button>
                  )}
                </div>

                <div>
                  <label style={label}>Concepto</label>
                  <input
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    maxLength={200}
                    placeholder={tab === "ingreso" ? "p. ej. Nómina" : "p. ej. Café"}
                    onFocus={focusA}
                    onBlur={blurA}
                    style={field}
                  />
                </div>

                {/* Cuenta destino (si no está fija) */}
                {!lockAccount && (
                  <div>
                    <label style={label}>Cuenta</label>
                    <ModalSelect
                      value={accountId === "" ? "" : String(accountId)}
                      onChange={(v) => setAccountId(v === "" ? "" : Number(v))}
                      accent={accent}
                      placeholder="Elige una cuenta"
                      options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
                    />
                  </div>
                )}

                {/* Origen del ingreso: crédito siempre; cash/débito/inversión opcional */}
                {tab === "ingreso" && effectiveTarget && (
                  <div>
                    <label style={label}>
                      {isCredit ? "¿Desde qué cuenta pagas?" : "¿Viene de otra de tus cuentas?"}
                    </label>
                    <ModalSelect
                      value={fromAccountId === "" ? "" : String(fromAccountId)}
                      onChange={(v) => setFromAccountId(v === "" ? "" : Number(v))}
                      accent={accent}
                      options={[
                        { value: "", label: isCredit ? "Elige la cuenta de origen" : "No, es dinero nuevo" },
                        ...sourceOptions.map((a) => ({
                          value: String(a.id),
                          label: `${a.name} · ${formatMXN(a.balancePesos)}`,
                        })),
                      ]}
                    />
                  </div>
                )}

                {/* Categoría — solo income/expense puros (las transferencias no llevan) */}
                {!isTransfer && !lockCategory && categories.length > 0 && (
                  <div>
                    <label style={label}>Categoría</label>
                    <ModalSelect
                      value={categoryId === "" ? "" : String(categoryId)}
                      onChange={(v) => setCategoryId(v === "" ? "" : Number(v))}
                      accent={accent}
                      options={[
                        { value: "", label: "Sin categoría" },
                        ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                      ]}
                    />
                  </div>
                )}

                {/* Fecha (mini calendario) */}
                <div>
                  <label style={label}>Fecha</label>
                  <button
                    ref={dateBtnRef}
                    type="button"
                    onClick={openCal}
                    style={{
                      ...field,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      borderColor: calOpen ? accent : "var(--border)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "capitalize" }}>
                      <Icon icon="mdi:calendar-blank-outline" style={{ fontSize: 16, color: "var(--text-muted)" }} />
                      {humanDateLabel(date)}
                    </span>
                    {isProjection && (
                      <span style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>proyección</span>
                    )}
                  </button>
                </div>
              </>
            )}

            {error && (
              <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--negative)" }}>{error}</p>
            )}
          </div>

          <div style={{ paddingTop: 16 }}>
            <button type="button" onClick={() => submit(close)} disabled={!valid || pending} style={btnStyle}>
              {pending ? "Guardando…" : tab === "ajuste" ? "Ajustar saldo" : finalSubmitLabel}
            </button>
          </div>

          {calOpen &&
            calRect &&
            createPortal(
              <div
                style={{
                  position: "fixed",
                  zIndex: 1000,
                  left: Math.max(8, Math.min(calRect.left, window.innerWidth - 232 - 8)),
                  top: calFlip ? undefined : calRect.bottom + 6,
                  bottom: calFlip ? window.innerHeight - calRect.top + 6 : undefined,
                }}
              >
                <MiniCalendar
                  value={date}
                  onChange={(v) => {
                    const key = typeof v === "object" && v ? v.start : v;
                    if (key) setDate(key);
                    setCalOpen(false);
                  }}
                  onClose={() => setCalOpen(false)}
                  accent={accent}
                  initialY={calYM.y}
                  initialM={calYM.m}
                  triggerRef={dateBtnRef}
                  allowRange={false}
                />
              </div>,
              document.body
            )}
        </>
      )}
    </MorphModal>
  );
}
