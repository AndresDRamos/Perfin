"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardV2Data, EntryView } from "@/app/actions/dashboard";
import { createExpenseCategoryAction } from "@/app/actions/catalog";
import { formatMXN, inputClass } from "./ui";

interface Props {
  currentPlan: DashboardV2Data["currentPlan"];
  entriesByDay: Record<string, EntryView[]>;
  onCapture: (categoryId: number, opts: { schedule: boolean }) => void;
}

// Budget progress for the plan covering today, sorted by % spent (most
// consumed first — the payload arrives pre-sorted). No current plan → invite
// the user to create one.
export function BudgetBars({ currentPlan, entriesByDay, onCapture }: Props) {
  const [openCategoryId, setOpenCategoryId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  if (!currentPlan) {
    return (
      <section className="space-y-2 rounded-lg border border-dashed p-4 text-center">
        <h2 className="text-lg font-semibold">Presupuestos</h2>
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          Aún no tienes un plan para este periodo. Crea uno para ver aquí cuánto llevas gastado
          por categoría.
        </p>
        <Link
          href="/plans"
          className="inline-block rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white"
        >
          Crear un plan
        </Link>
      </section>
    );
  }

  if (currentPlan.bars.length === 0) {
    return (
      <section className="space-y-2 rounded-lg border border-dashed p-4 text-center">
        <h2 className="text-lg font-semibold">Presupuestos</h2>
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          Tu plan “{currentPlan.name}” no tiene topes por categoría todavía.
        </p>
        <Link
          href={`/plans/${currentPlan.id}`}
          className="inline-block rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white"
        >
          Agregar presupuestos
        </Link>
      </section>
    );
  }

  // Transactions of the open category within the plan period (limited to the
  // dashboard's fetched window, today−40/+30 — enough for typical monthly plans).
  const categoryEntries = (categoryId: number): EntryView[] =>
    Object.values(entriesByDay)
      .flat()
      .filter(
        (e) =>
          e.kind === "expense" &&
          e.categoryId === categoryId &&
          e.date >= currentPlan.periodStart &&
          e.date <= currentPlan.periodEnd
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));

  async function createCategory() {
    if (!newCategory.trim()) return;
    setCreatingCategory(true);
    await createExpenseCategoryAction({ name: newCategory.trim() });
    setCreatingCategory(false);
    setNewCategory("");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Presupuestos</h2>
        <Link
          href={`/plans/${currentPlan.id}`}
          className="rounded px-2 py-1.5 text-sm text-primary-700 hover:underline dark:text-primary-400"
        >
          {currentPlan.name} →
        </Link>
      </div>

      <div className="space-y-2">
        {currentPlan.bars.map((bar) => {
          const pct = bar.targetPesos > 0 ? bar.realPesos / bar.targetPesos : 0;
          const over = pct > 1;
          const open = openCategoryId === bar.categoryId;
          return (
            <div key={bar.budgetId} className="rounded-lg border">
              <button
                type="button"
                onClick={() => setOpenCategoryId(open ? null : bar.categoryId)}
                className="w-full space-y-1.5 px-3.5 py-3 text-left"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{bar.categoryName}</span>
                  <span className="shrink-0 text-xs text-secondary-600 dark:text-secondary-300">
                    {formatMXN(bar.realPesos)} / {formatMXN(bar.targetPesos)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary-100 dark:bg-secondary-800">
                  <div
                    className={`h-full rounded-full ${over ? "bg-red-600" : "bg-primary-500"}`}
                    style={{ width: `${Math.min(Math.round(pct * 100), 100)}%` }}
                  />
                </div>
                <p className="text-right text-[11px] text-secondary-600 dark:text-secondary-300">
                  {Math.round(pct * 100)}%{over ? " · excedido" : ""}
                </p>
              </button>

              {open && (
                <div className="space-y-2 border-t px-3.5 py-3">
                  {categoryEntries(bar.categoryId).length === 0 ? (
                    <p className="text-xs text-secondary-600 dark:text-secondary-300">
                      Sin gastos de esta categoría en el periodo.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {categoryEntries(bar.categoryId).map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">
                            {e.concept || "Gasto"}
                            <span className="text-xs text-secondary-600 dark:text-secondary-300">
                              {" "}
                              · {e.date.slice(8)}/{e.date.slice(5, 7)}
                              {e.status === "projected" ? " · proyectado" : ""}
                            </span>
                          </span>
                          <span className="shrink-0 font-medium text-red-600">
                            −{formatMXN(e.amountPesos)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onCapture(bar.categoryId, { schedule: false })}
                      className="rounded-full bg-primary-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      + Registrar gasto
                    </button>
                    <button
                      type="button"
                      onClick={() => onCapture(bar.categoryId, { schedule: true })}
                      className="rounded-full bg-secondary-100 px-3 py-1.5 text-xs text-secondary-700 dark:bg-secondary-800 dark:text-secondary-200"
                    >
                      Programar gasto
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* light inline category management; full CRUD lives in /categories */}
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          maxLength={100}
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className={`${inputClass} mt-0 flex-1`}
          placeholder="Nueva categoría de gasto…"
        />
        <button
          type="button"
          onClick={createCategory}
          disabled={creatingCategory || !newCategory.trim()}
          className="shrink-0 rounded bg-secondary-100 px-3 text-sm text-secondary-700 disabled:opacity-50 dark:bg-secondary-800 dark:text-secondary-200"
        >
          Crear
        </button>
        <Link
          href="/categories"
          className="flex shrink-0 items-center rounded px-2 text-sm text-primary-700 hover:underline dark:text-primary-400"
        >
          Editar →
        </Link>
      </div>
    </section>
  );
}
