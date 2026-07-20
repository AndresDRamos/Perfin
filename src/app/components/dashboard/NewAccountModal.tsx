"use client";

import { useState, type CSSProperties } from "react";
import { createAccountAction, updateAccountAction } from "@/app/actions/accounts";
import type { AccountCardView } from "@/app/actions/dashboard";
import type { AccountKind } from "@/lib/branding/account-kind";
import { MorphModal, type MorphClose } from "@/app/components/ui/MorphModal";
import { KindCard } from "@/app/components/ui/KindCard";
import { KitButton } from "@/app/components/ui/Button";
import {
  KIND_ACCENT,
  formatMontoInput,
  modalField,
  modalLabel,
  modalPill,
  montoInputToPesos,
  pesosToMontoInput,
  type OriginRect,
} from "@/app/components/ui/kit";

interface Props {
  origin: OriginRect;
  onClose: () => void;
  // Presente → modo edición. kind y saldo inicial son INMUTABLES tras crear
  // (contrato de account-write), así que en edición solo nombre/banco/días.
  account?: AccountCardView & { bank?: string | null };
  topInset?: number;
}

const KINDS: { kind: AccountKind; icon: string; label: string }[] = [
  { kind: "cash", icon: "mdi:cash", label: "Efectivo" },
  { kind: "debit", icon: "mdi:bank", label: "Débito" },
  { kind: "credit", icon: "mdi:credit-card", label: "Crédito" },
  { kind: "investment", icon: "mdi:chart-finance", label: "Inversión" },
];

// "Nueva cuenta" / "Editar cuenta" (kit NewAccountModal.jsx) sobre las
// acciones reales. Crédito captura la deuda actual (se guarda negada, saldo
// firmado) y sus días de corte/pago.
export function NewAccountModal({ origin, onClose, account, topInset = 0 }: Props) {
  const editing = !!account;
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "cash");
  const [balance, setBalance] = useState(
    account ? pesosToMontoInput(account.balancePesos) : ""
  );
  const [bank, setBank] = useState(account?.bank ?? "");
  const [cutoffDay, setCutoffDay] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCredit = kind === "credit";
  const valid =
    name.trim() !== "" &&
    (editing || !isCredit || (cutoffDay !== "" && paymentDay !== "" && cutoffDay !== paymentDay));

  async function submit(close: MorphClose) {
    if (!valid || pending) return;
    setPending(true);
    setError(null);

    let res: { ok: boolean; errors?: Record<string, string[] | undefined> };
    if (editing) {
      res = await updateAccountAction(account!.id, {
        name: name.trim(),
        ...(kind !== "cash" ? { bank: bank.trim() === "" ? null : bank.trim() } : {}),
      });
    } else {
      const pesos = montoInputToPesos(balance);
      const base = {
        name: name.trim(),
        // Crédito: el usuario captura su DEUDA actual; el saldo firmado la
        // guarda negativa (fix del plan plan-types-dashboard-neto).
        openingBalancePesos: isCredit ? -Math.abs(pesos) : pesos,
      };
      const raw =
        kind === "cash"
          ? { kind, ...base }
          : kind === "credit"
            ? {
                kind,
                ...base,
                ...(bank.trim() ? { bank: bank.trim() } : {}),
                cutoffDay: Number(cutoffDay),
                paymentDay: Number(paymentDay),
              }
            : { kind, ...base, ...(bank.trim() ? { bank: bank.trim() } : {}) };
      res = await createAccountAction(raw);
    }

    setPending(false);
    if (res.ok) {
      close("success");
    } else {
      const first = res.errors ? Object.values(res.errors).flat()[0] : null;
      setError(first ?? "No se pudo guardar la cuenta");
    }
  }

  const dayField: CSSProperties = { ...modalField, textAlign: "center" };

  return (
    <MorphModal
      origin={origin}
      onClose={onClose}
      title={editing ? "Editar cuenta" : "Nueva cuenta"}
      height={editing ? 440 : isCredit ? 640 : 560}
      successMessage={editing ? "Cuenta actualizada" : "Cuenta creada"}
      topInset={topInset}
    >
      {(close) => (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1, scrollbarWidth: "none" }}>
            <div>
              <label style={modalLabel}>Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="BBVA débito"
                style={modalField}
              />
            </div>

            {!editing ? (
              <div>
                <label style={modalLabel}>Tipo</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {KINDS.map((k) => (
                    <KindCard
                      key={k.kind}
                      icon={k.icon}
                      label={k.label}
                      accent={KIND_ACCENT[k.kind]}
                      selected={kind === k.kind}
                      onClick={() => setKind(k.kind)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <span style={{ ...modalPill, alignSelf: "flex-start" }}>
                <span style={{ color: "var(--text-muted)" }}>Tipo</span>
                <strong style={{ fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"] }}>
                  {KINDS.find((k) => k.kind === kind)?.label}
                </strong>
              </span>
            )}

            {kind !== "cash" && (
              <div>
                <label style={modalLabel}>Banco (opcional)</label>
                <input
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  maxLength={100}
                  placeholder="BBVA"
                  style={modalField}
                />
              </div>
            )}

            {!editing && (
              <div>
                <label style={modalLabel}>{isCredit ? "Deuda actual (MXN)" : "Saldo inicial (MXN)"}</label>
                <input
                  value={balance}
                  onChange={(e) => setBalance(formatMontoInput(e.target.value))}
                  inputMode="numeric"
                  placeholder="0.00"
                  style={modalField}
                />
              </div>
            )}

            {!editing && isCredit && (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={modalLabel}>Día de corte (1–28)</label>
                  <input
                    value={cutoffDay}
                    onChange={(e) => setCutoffDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    inputMode="numeric"
                    placeholder="15"
                    style={dayField}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={modalLabel}>Día de pago (1–28)</label>
                  <input
                    value={paymentDay}
                    onChange={(e) => setPaymentDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    inputMode="numeric"
                    placeholder="5"
                    style={dayField}
                  />
                </div>
              </div>
            )}

            {error && <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--negative)" }}>{error}</p>}
          </div>

          <div style={{ paddingTop: 16 }}>
            <KitButton onClick={() => submit(close)} disabled={!valid || pending}>
              {pending ? "Guardando…" : editing ? "Guardar cambios" : "Agregar cuenta"}
            </KitButton>
          </div>
        </>
      )}
    </MorphModal>
  );
}
