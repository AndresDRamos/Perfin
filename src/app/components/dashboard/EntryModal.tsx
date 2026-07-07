"use client";

import { useState } from "react";
import { captureEntry } from "@/app/actions/ledger";
import type { AccountCardView } from "@/app/actions/dashboard";
import {
  Modal,
  formatMXN,
  inputClass,
  labelClass,
  primaryButtonClass,
  chipButtonClass,
} from "./ui";

interface Category {
  id: number;
  name: string;
}

// Context the opener sets. `account` fixes the target account (tap on an
// account card); `categoryId` prefills the category (tap from a budget bar);
// `date`/`status` preset scheduling (from the day detail / budget "programar").
export interface EntryModalPreset {
  account?: AccountCardView;
  kind?: "income" | "expense";
  categoryId?: number;
  date?: string;
  status?: "cleared" | "projected";
}

interface Props {
  preset: EntryModalPreset;
  accounts: AccountCardView[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  onClose: () => void;
}

type Tab = "expense" | "income" | "adjust";

interface Errors {
  [k: string]: string[] | undefined;
}

// Contextual capture, per account kind (plan decisions 5a-5d):
// - income into cash/debit asks "does it come from another of your accounts?"
//   → yes = transfer (source → this account);
// - investment additionally offers "adjust total balance" → an income/expense
//   for the difference (the balance itself stays derived, never stored);
// - credit: an income IS a payment = transfer from another own account, with
//   a "liquidar" shortcut that prefills the full owed amount.
export function EntryModal({ preset, accounts, incomeCategories, expenseCategories, onClose }: Props) {
  const target = preset.account;
  const isCredit = target?.kind === "credit";
  const isInvestment = target?.kind === "investment";

  const [tab, setTab] = useState<Tab>(preset.kind ?? "expense");
  const [accountId, setAccountId] = useState<number | "">(target?.id ?? "");
  const [fromAccountId, setFromAccountId] = useState<number | "">("");
  const [amount, setAmount] = useState<string>("");
  const [newTotal, setNewTotal] = useState<string>("");
  const [concept, setConcept] = useState<string>("");
  const [date, setDate] = useState<string>(preset.date ?? new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"cleared" | "projected">(preset.status ?? "cleared");
  const [categoryId, setCategoryId] = useState<number | "">(preset.categoryId ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const effectiveTarget = target ?? accounts.find((a) => a.id === accountId);
  const sourceOptions = accounts.filter((a) => a.id !== effectiveTarget?.id);
  const owed = isCredit && target ? Math.max(-target.balancePesos, 0) : 0;
  const categories = tab === "income" ? incomeCategories : expenseCategories;

  async function submit() {
    setPending(true);
    setErrors({});
    let raw: Record<string, unknown>;

    if (tab === "adjust") {
      // Investment balance adjustment: one entry for the difference.
      const total = Number(newTotal);
      const diff = Math.round((total - (effectiveTarget?.balancePesos ?? 0)) * 100) / 100;
      if (!newTotal || Number.isNaN(total) || diff === 0) {
        setErrors({ amountPesos: ["El nuevo saldo debe ser diferente al actual"] });
        setPending(false);
        return;
      }
      raw = {
        kind: diff > 0 ? "income" : "expense",
        amountPesos: Math.abs(diff),
        concept: concept || "Ajuste de saldo",
        occurredAt: date,
        status: "cleared",
        accountId: effectiveTarget!.id,
      };
    } else if (tab === "income" && (isCredit || fromAccountId !== "")) {
      // Payment to a credit card / funded income = transfer between own accounts.
      if (fromAccountId === "") {
        setErrors({ toAccountId: ["Elige la cuenta de origen del pago"] });
        setPending(false);
        return;
      }
      raw = {
        kind: "transfer",
        amountPesos: Number(amount),
        concept: concept || undefined,
        occurredAt: date,
        status,
        accountId: fromAccountId,
        toAccountId: effectiveTarget!.id,
      };
    } else {
      raw = {
        kind: tab,
        amountPesos: Number(amount),
        concept: concept || undefined,
        occurredAt: date,
        status,
        accountId: effectiveTarget?.id ?? accountId,
        categoryId: categoryId === "" ? undefined : categoryId,
      };
    }

    const res = await captureEntry(raw);
    setPending(false);
    if (res.ok) {
      setDone(true);
      setTimeout(onClose, 600);
    } else {
      setErrors(res.errors ?? {});
    }
  }

  const title = target
    ? `${target.name} · ${formatMXN(target.balancePesos)}`
    : "Registrar movimiento";

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {/* tabs */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTab("expense")} className={chipButtonClass(tab === "expense")}>
            {isCredit ? "Compra" : "Gasto"}
          </button>
          <button type="button" onClick={() => setTab("income")} className={chipButtonClass(tab === "income")}>
            {isCredit ? "Pago" : "Ingreso"}
          </button>
          {isInvestment && (
            <button type="button" onClick={() => setTab("adjust")} className={chipButtonClass(tab === "adjust")}>
              Ajustar saldo
            </button>
          )}
        </div>

        {/* no fixed account → pick one */}
        {!target && tab !== "adjust" && (
          <div>
            <label className={labelClass}>Cuenta</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
              className={inputClass}
            >
              <option value="">Elige una cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {tab === "adjust" ? (
          <div>
            <label className={labelClass}>Nuevo saldo total (MXN)</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={newTotal}
              onChange={(e) => setNewTotal(e.target.value)}
              className={inputClass}
              placeholder={String(effectiveTarget?.balancePesos ?? 0)}
            />
            <p className="mt-1 text-xs text-secondary-600 dark:text-secondary-300">
              Se registra un ajuste por la diferencia contra el saldo actual (
              {formatMXN(effectiveTarget?.balancePesos ?? 0)}); el saldo sigue derivado de tus
              movimientos.
            </p>
            {errors.amountPesos && <p className="mt-1 text-xs text-red-600">{errors.amountPesos[0]}</p>}
          </div>
        ) : (
          <>
            {/* amount */}
            <div>
              <label className={labelClass}>Monto (MXN)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
              {isCredit && tab === "income" && owed > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(owed))}
                  className="mt-1.5 text-sm text-primary-700 underline dark:text-primary-400"
                >
                  Liquidar por completo ({formatMXN(owed)})
                </button>
              )}
              {errors.amountPesos && <p className="mt-1 text-xs text-red-600">{errors.amountPesos[0]}</p>}
            </div>

            {/* income origin: credit always needs it; cash/debit/investment optional */}
            {tab === "income" && (
              <div>
                <label className={labelClass}>
                  {isCredit ? "¿Desde qué cuenta pagas?" : "¿Viene de otra de tus cuentas?"}
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputClass}
                >
                  <option value="">{isCredit ? "Elige la cuenta de origen" : "No, es dinero nuevo"}</option>
                  {sourceOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {formatMXN(a.balancePesos)}
                    </option>
                  ))}
                </select>
                {errors.toAccountId && <p className="mt-1 text-xs text-red-600">{errors.toAccountId[0]}</p>}
              </div>
            )}

            {/* category — only for pure income/expense (transfers carry none) */}
            {!(tab === "income" && (isCredit || fromAccountId !== "")) && categories.length > 0 && (
              <div>
                <label className={labelClass}>Categoría</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputClass}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* status */}
            <div>
              <label className={labelClass}>Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "cleared" | "projected")}
                className={inputClass}
              >
                <option value="cleared">Confirmado</option>
                <option value="projected">Proyectado</option>
              </select>
            </div>
          </>
        )}

        {/* concept */}
        <div>
          <label className={labelClass}>Concepto</label>
          <input
            type="text"
            maxLength={200}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className={inputClass}
            placeholder="Descripción opcional"
          />
        </div>

        {/* date */}
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>

        {done && <p className="text-sm text-primary-700 dark:text-primary-400">Movimiento registrado.</p>}

        <button type="button" onClick={submit} disabled={pending || done} className={primaryButtonClass}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}
