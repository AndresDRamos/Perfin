"use client";

import { useState, useTransition, useActionState } from "react";
import {
  createIncomeCategoryAction,
  updateIncomeCategoryAction,
  deactivateIncomeCategoryAction,
  createExpenseCategoryAction,
  updateExpenseCategoryAction,
  deactivateExpenseCategoryAction,
} from "@/app/actions/catalog";
import type { IncomeCategoryRow, ExpenseCategoryRow } from "@/data/schema";

interface Props {
  incomeCategories: IncomeCategoryRow[];
  expenseCategories: ExpenseCategoryRow[];
}

interface CategoryFormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

// ─── Small inline form for creating a new category ───────────────────────────

function NewCategoryForm({ type }: { type: "income" | "expense" }) {
  const createAction =
    type === "income" ? createIncomeCategoryAction : createExpenseCategoryAction;

  const [state, action, pending] = useActionState(
    async (_prev: CategoryFormState, fd: FormData): Promise<CategoryFormState> => {
      const raw: Record<string, unknown> = {
        name: fd.get("name"),
        description: fd.get("description") || undefined,
      };
      if (type === "expense") raw.isSavings = false;
      return createAction(raw);
    },
    {} as CategoryFormState
  );

  return (
    <form action={action} className="flex gap-2 mt-3">
      <div className="flex-1">
        <input
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder="Nueva categoría"
          className="w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.name && (
          <p className="text-negative text-xs mt-0.5">{state.errors.name[0]}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {pending ? "…" : "Agregar"}
      </button>
      {state.ok && (
        <span className="self-center text-green-600 text-sm">✓</span>
      )}
    </form>
  );
}

// ─── Single category row with deactivate button ───────────────────────────────

function CategoryRow({
  row,
  type,
}: {
  row: IncomeCategoryRow | ExpenseCategoryRow;
  type: "income" | "expense";
}) {
  const [, startTransition] = useTransition();
  const deactivate =
    type === "income" ? deactivateIncomeCategoryAction : deactivateExpenseCategoryAction;

  const isSavingsRow = "isSavings" in row && row.isSavings;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-2 ${
        !row.isActive ? "opacity-40" : ""
      }`}
    >
      <div>
        <span className="text-sm font-medium">{row.name}</span>
        {isSavingsRow && (
          <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">
            ahorro
          </span>
        )}
        {!row.isActive && (
          <span className="ml-2 text-xs text-text-muted">inactiva</span>
        )}
      </div>
      {row.isActive && !isSavingsRow && (
        <button
          type="button"
          onClick={() => startTransition(() => { void deactivate(row.id); })}
          className="text-xs text-red-500 hover:underline"
        >
          Desactivar
        </button>
      )}
    </div>
  );
}

// ─── Main list component ──────────────────────────────────────────────────────

export function CategoryList({ incomeCategories, expenseCategories }: Props) {
  return (
    <div className="space-y-8">
      {/* Income */}
      <section>
        <h2 className="font-semibold text-base mb-2">Ingresos</h2>
        <div className="space-y-1.5">
          {incomeCategories.length === 0 && (
            <p className="text-sm text-text-muted">Sin categorías todavía.</p>
          )}
          {incomeCategories.map((c) => (
            <CategoryRow key={c.id} row={c} type="income" />
          ))}
        </div>
        <NewCategoryForm type="income" />
      </section>

      {/* Expense */}
      <section>
        <h2 className="font-semibold text-base mb-2">Gastos</h2>
        <div className="space-y-1.5">
          {expenseCategories.length === 0 && (
            <p className="text-sm text-text-muted">Sin categorías todavía.</p>
          )}
          {expenseCategories.map((c) => (
            <CategoryRow key={c.id} row={c} type="expense" />
          ))}
        </div>
        <NewCategoryForm type="expense" />
      </section>
    </div>
  );
}
