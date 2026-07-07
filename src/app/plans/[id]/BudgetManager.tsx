"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createBudgetAction,
  deleteBudgetAction,
  type PlanDetail,
} from "@/app/actions/budgets";
import type { BudgetProgress } from "@/data/budget-repo";

interface Props {
  planId: number;
  progress: BudgetProgress[];
  expenseCategories: PlanDetail["expenseCategories"];
  accounts: PlanDetail["accounts"];
}

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

const SUBTYPE_LABELS: Record<string, string> = {
  category_cap: "Tope de categoría",
  savings_reservation: "Reserva de ahorro",
  purchase_goal: "Meta de compra",
};

const HORIZON_LABELS: Record<string, string> = {
  short: "Corto plazo",
  medium: "Mediano plazo",
  long: "Largo plazo",
};

function pesos(centavos: number): string {
  return (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// ─── progress display per budget ─────────────────────────────────────────────────

function BudgetCard({
  planId,
  item,
  names,
}: {
  planId: number;
  item: BudgetProgress;
  names: { categories: Map<number, string>; accounts: Map<number, string> };
}) {
  const [, startTransition] = useTransition();
  const b = item.budget;
  const target = b.targetAmount;
  const hasActual = b.subtype !== "purchase_goal";
  const pct = hasActual && target > 0 ? Math.min(100, (item.realActual / target) * 100) : 0;
  // A cap is "over" when spend exceeds it; a reservation is just progress toward target.
  const over = b.subtype === "category_cap" && item.realActual > target;

  const label =
    b.subtype === "category_cap"
      ? (names.categories.get(b.expenseCategoryId ?? -1) ?? `Categoría #${b.expenseCategoryId}`)
      : b.subtype === "savings_reservation"
        ? (names.accounts.get(b.accountId ?? -1) ?? `Cuenta #${b.accountId}`)
        : b.itemName;

  return (
    <div className="rounded-lg border px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">{label}</span>
          <span className="ml-2 rounded bg-secondary-100 px-1.5 py-0.5 text-xs text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300">
            {SUBTYPE_LABELS[b.subtype]}
          </span>
          {b.subtype === "purchase_goal" && b.horizon && (
            <span className="ml-1 text-xs text-gray-400">{HORIZON_LABELS[b.horizon]}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              void deleteBudgetAction(b.id, planId);
            })
          }
          className="text-xs text-red-500 hover:underline"
        >
          Eliminar
        </button>
      </div>

      {hasActual ? (
        <>
          <div className="h-2 w-full overflow-hidden rounded bg-secondary-100 dark:bg-secondary-800">
            <div
              className={`h-full ${over ? "bg-red-500" : "bg-primary-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-secondary-600 dark:text-secondary-300">
            <span>
              {pesos(item.realActual)}
              {item.projectedActual !== item.realActual && (
                <span className="text-gray-400"> (proy. {pesos(item.projectedActual)})</span>
              )}
            </span>
            <span>de {pesos(target)}</span>
          </div>
        </>
      ) : (
        <div className="text-xs text-secondary-600 dark:text-secondary-300">
          Meta: {pesos(target)}
        </div>
      )}

      {b.periodStart && b.periodEnd && (
        <p className="text-xs text-gray-400">
          Periodo propio: {b.periodStart} → {b.periodEnd}
        </p>
      )}
    </div>
  );
}

// ─── new budget form ──────────────────────────────────────────────────────────────

function NewBudgetForm({ planId, expenseCategories, accounts }: Props) {
  const [subtype, setSubtype] = useState<
    "category_cap" | "savings_reservation" | "purchase_goal"
  >("category_cap");

  const [state, action, pending] = useActionState(
    async (_prev: FormState, fd: FormData): Promise<FormState> => {
      const base = {
        planId,
        subtype,
        targetAmountPesos: Number(fd.get("targetAmountPesos")),
      };
      const overrideStart = fd.get("periodStart");
      const overrideEnd = fd.get("periodEnd");
      const period =
        overrideStart && overrideEnd
          ? { periodStart: overrideStart, periodEnd: overrideEnd }
          : {};

      let raw: Record<string, unknown> = { ...base, ...period };
      if (subtype === "category_cap") {
        raw = { ...raw, expenseCategoryId: Number(fd.get("expenseCategoryId")) };
      } else if (subtype === "savings_reservation") {
        raw = { ...raw, accountId: Number(fd.get("accountId")) };
      } else {
        raw = { ...raw, itemName: fd.get("itemName"), horizon: fd.get("horizon") };
      }
      return createBudgetAction(raw);
    },
    {} as FormState
  );

  return (
    <form action={action} className="space-y-2 rounded-lg border p-4">
      <h2 className="font-semibold text-base">Nuevo presupuesto</h2>

      <select
        name="subtype"
        value={subtype}
        onChange={(e) => setSubtype(e.target.value as typeof subtype)}
        className="w-full rounded border px-3 py-1.5 text-sm"
      >
        <option value="category_cap">Tope de categoría</option>
        <option value="savings_reservation">Reserva de ahorro</option>
        <option value="purchase_goal">Meta de compra</option>
      </select>

      {subtype === "category_cap" && (
        <div>
          <select
            name="expenseCategoryId"
            required
            className="w-full rounded border px-3 py-1.5 text-sm"
          >
            <option value="">Categoría de gasto…</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {state.errors?.expenseCategoryId && (
            <p className="text-red-600 text-xs mt-0.5">{state.errors.expenseCategoryId[0]}</p>
          )}
        </div>
      )}

      {subtype === "savings_reservation" && (
        <div>
          <select
            name="accountId"
            required
            className="w-full rounded border px-3 py-1.5 text-sm"
          >
            <option value="">Cuenta destino…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {state.errors?.accountId && (
            <p className="text-red-600 text-xs mt-0.5">{state.errors.accountId[0]}</p>
          )}
        </div>
      )}

      {subtype === "purchase_goal" && (
        <div className="flex gap-2">
          <input
            name="itemName"
            type="text"
            required
            maxLength={100}
            placeholder="Artículo"
            className="flex-1 rounded border px-3 py-1.5 text-sm"
          />
          <select name="horizon" required className="rounded border px-3 py-1.5 text-sm">
            <option value="short">Corto</option>
            <option value="medium">Mediano</option>
            <option value="long">Largo</option>
          </select>
        </div>
      )}

      <div>
        <input
          name="targetAmountPesos"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="Monto objetivo (MXN)"
          className="w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.targetAmountPesos && (
          <p className="text-red-600 text-xs mt-0.5">{state.errors.targetAmountPesos[0]}</p>
        )}
      </div>

      <details className="text-xs text-secondary-600 dark:text-secondary-300">
        <summary className="cursor-pointer">Periodo propio (opcional)</summary>
        <div className="mt-2 flex gap-2">
          <input name="periodStart" type="date" className="flex-1 rounded border px-3 py-1.5" />
          <input name="periodEnd" type="date" className="flex-1 rounded border px-3 py-1.5" />
        </div>
        {state.errors?.periodEnd && (
          <p className="text-red-600 text-xs mt-0.5">{state.errors.periodEnd[0]}</p>
        )}
      </details>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : "Agregar presupuesto"}
      </button>
    </form>
  );
}

// ─── manager ──────────────────────────────────────────────────────────────────────

export function BudgetManager(props: Props) {
  const { planId, progress, expenseCategories, accounts } = props;
  const names = {
    categories: new Map(expenseCategories.map((c) => [c.id, c.name])),
    accounts: new Map(accounts.map((a) => [a.id, a.name])),
  };
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {progress.length === 0 && (
          <p className="text-sm text-gray-400">Sin presupuestos todavía.</p>
        )}
        {progress.map((item) => (
          <BudgetCard key={item.budget.id} planId={planId} item={item} names={names} />
        ))}
      </div>
      <NewBudgetForm {...props} />
    </div>
  );
}
