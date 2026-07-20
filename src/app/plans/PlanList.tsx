"use client";

import { useState, useActionState, useTransition } from "react";
import { Icon } from "@iconify/react";
import { createPlanAction, deletePlanAction } from "@/app/actions/budgets";
import { createProjectionAction, deleteProjectionAction } from "@/app/actions/ledger";
import {
  createFixedExpenseAction,
  setFixedExpenseActiveAction,
  deleteFixedExpenseAction,
} from "@/app/actions/fixed-expenses";
import type {
  PlansPageData,
  ProjectionView,
  FixedExpenseView,
} from "@/app/actions/budgets";
import type { PlanRow } from "@/data/schema";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

function formatMXN(pesos: number) {
  return pesos.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatDate(iso: string) {
  // Los date de Postgres viajan como YYYY-MM-DD; anclar a mediodía evita el
  // corrimiento de día por TZ al formatear.
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX");
}

// ─── selector de tipo (primer paso del alta) ─────────────────────────────────

type PlanType = "budget" | "projection" | "fixed";

const TYPE_CARDS: { type: PlanType; icon: string; title: string; blurb: string }[] = [
  {
    type: "budget",
    icon: "mdi:bullseye-arrow",
    title: "Presupuesto",
    blurb: "Topes, reservas y metas sobre un periodo o una fecha",
  },
  {
    type: "projection",
    icon: "mdi:trending-up",
    title: "Proyección",
    blurb: "Un ingreso que esperas recibir; se concilia al llegar",
  },
  {
    type: "fixed",
    icon: "mdi:calendar-sync",
    title: "Fijo",
    blurb: "Un gasto recurrente que se carga solo cada mes",
  },
];

function TypeSelector({ onSelect }: { onSelect: (t: PlanType) => void }) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h2 className="font-semibold text-base">Nuevo plan</h2>
      <p className="text-xs text-secondary-600 dark:text-secondary-300">
        ¿Qué quieres planear?
      </p>
      <div className="space-y-2">
        {TYPE_CARDS.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => onSelect(c.type)}
            className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left hover:border-primary-500"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
              <Icon icon={c.icon} className="h-5 w-5 text-primary-700 dark:text-primary-300" />
            </span>
            <span>
              <span className="block text-sm font-medium">{c.title}</span>
              <span className="block text-xs text-secondary-600 dark:text-secondary-300">
                {c.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BackToTypes({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-semibold text-base">{title}</h2>
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-primary-700 hover:underline dark:text-primary-400"
      >
        ← Cambiar tipo
      </button>
    </div>
  );
}

// ─── formulario: Presupuesto ─────────────────────────────────────────────────

function BudgetPlanForm({ onBack }: { onBack: () => void }) {
  const [singleDate, setSingleDate] = useState(false);

  const [state, action, pending] = useActionState(
    async (_prev: FormState, fd: FormData): Promise<FormState> => {
      const periodStart = String(fd.get("periodStart") ?? "");
      const periodEnd = singleDate ? periodStart : String(fd.get("periodEnd") ?? "");
      // Nombre opcional con default derivado de las fechas.
      const typed = String(fd.get("name") ?? "").trim();
      const name =
        typed ||
        (singleDate
          ? `Plan para el ${formatDate(periodStart)}`
          : `Plan de ${formatDate(periodStart)} a ${formatDate(periodEnd)}`);
      return createPlanAction({ name, periodStart, periodEnd });
    },
    {} as FormState
  );

  return (
    <form action={action} className="space-y-2 rounded-lg border p-4">
      <BackToTypes onBack={onBack} title="Nuevo presupuesto" />
      <div>
        <input
          name="name"
          type="text"
          maxLength={100}
          placeholder="Nombre (opcional)"
          className="h-11 w-full rounded border px-3 text-sm"
        />
        {state.errors?.name && (
          <p className="text-negative text-xs mt-0.5">{state.errors.name[0]}</p>
        )}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={singleDate}
          onChange={(e) => setSingleDate(e.target.checked)}
          className="h-4 w-4"
        />
        Fecha única (en vez de periodo)
      </label>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-secondary-600 dark:text-secondary-300">
          {singleDate ? "Fecha" : "Inicio"}
          <input
            name="periodStart"
            type="date"
            required
            className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
          />
        </label>
        {!singleDate && (
          <label className="flex-1 text-xs text-secondary-600 dark:text-secondary-300">
            Fin
            <input
              name="periodEnd"
              type="date"
              required
              className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
            />
          </label>
        )}
      </div>
      {state.errors?.periodEnd && (
        <p className="text-negative text-xs">{state.errors.periodEnd[0]}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : "Crear presupuesto"}
      </button>
    </form>
  );
}

// ─── formulario: Proyección ──────────────────────────────────────────────────

function ProjectionForm({
  accounts,
  onBack,
}: {
  accounts: PlansPageData["accounts"];
  onBack: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (_prev: FormState, fd: FormData): Promise<FormState> =>
      createProjectionAction({
        concept: String(fd.get("concept") ?? "").trim() || undefined,
        amountPesos: Number(fd.get("amountPesos")),
        occurredAt: fd.get("occurredAt"),
        accountId: Number(fd.get("accountId")),
      }),
    {} as FormState
  );

  return (
    <form action={action} className="space-y-2 rounded-lg border p-4">
      <BackToTypes onBack={onBack} title="Nueva proyección de ingreso" />
      <input
        name="concept"
        type="text"
        maxLength={200}
        placeholder="Concepto (ej. Nómina quincena)"
        className="h-11 w-full rounded border px-3 text-sm"
      />
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-secondary-600 dark:text-secondary-300">
          Fecha esperada
          <input
            name="occurredAt"
            type="date"
            required
            className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
          />
        </label>
        <label className="flex-1 text-xs text-secondary-600 dark:text-secondary-300">
          Monto esperado
          <input
            name="amountPesos"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
          />
        </label>
      </div>
      {state.errors?.amountPesos && (
        <p className="text-negative text-xs">{state.errors.amountPesos[0]}</p>
      )}
      <div>
        <select
          name="accountId"
          required
          className="h-11 w-full rounded border px-3 text-sm"
        >
          <option value="">Cuenta destino…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {state.errors?.accountId && (
          <p className="text-negative text-xs mt-0.5">{state.errors.accountId[0]}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : "Crear proyección"}
      </button>
    </form>
  );
}

// ─── formulario: Fijo ────────────────────────────────────────────────────────

function FixedExpenseForm({
  accounts,
  fixedCategories,
  onBack,
}: {
  accounts: PlansPageData["accounts"];
  fixedCategories: PlansPageData["fixedCategories"];
  onBack: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (_prev: FormState, fd: FormData): Promise<FormState> => {
      const endDate = String(fd.get("endDate") ?? "");
      return createFixedExpenseAction({
        name: fd.get("name"),
        amountPesos: Number(fd.get("amountPesos")),
        dayOfMonth: Number(fd.get("dayOfMonth")),
        accountId: Number(fd.get("accountId")),
        expenseCategoryId: Number(fd.get("expenseCategoryId")),
        startDate: fd.get("startDate"),
        ...(endDate && { endDate }),
      });
    },
    {} as FormState
  );

  return (
    <form action={action} className="space-y-2 rounded-lg border p-4">
      <BackToTypes onBack={onBack} title="Nuevo gasto fijo" />
      <p className="text-xs text-secondary-600 dark:text-secondary-300">
        Cada mes se registra solo como gasto confirmado en la cuenta elegida.
      </p>
      <div>
        <input
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder="Nombre (ej. Internet)"
          className="h-11 w-full rounded border px-3 text-sm"
        />
        {state.errors?.name && (
          <p className="text-negative text-xs mt-0.5">{state.errors.name[0]}</p>
        )}
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-secondary-600 dark:text-secondary-300">
          Monto mensual
          <input
            name="amountPesos"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
          />
        </label>
        <label className="w-28 shrink-0 text-xs text-secondary-600 dark:text-secondary-300">
          Día del mes
          <input
            name="dayOfMonth"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            required
            placeholder="1–31"
            className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
          />
        </label>
      </div>
      {state.errors?.dayOfMonth && (
        <p className="text-negative text-xs">{state.errors.dayOfMonth[0]}</p>
      )}
      <div>
        <select name="accountId" required className="h-11 w-full rounded border px-3 text-sm">
          <option value="">Cuenta de cargo…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <select
          name="expenseCategoryId"
          required
          className="h-11 w-full rounded border px-3 text-sm"
        >
          <option value="">Categoría…</option>
          {fixedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {state.errors?.expenseCategoryId && (
          <p className="text-negative text-xs mt-0.5">{state.errors.expenseCategoryId[0]}</p>
        )}
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-secondary-600 dark:text-secondary-300">
          Desde
          <input
            name="startDate"
            type="date"
            required
            className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
          />
        </label>
        <label className="flex-1 text-xs text-secondary-600 dark:text-secondary-300">
          Hasta (opcional)
          <input
            name="endDate"
            type="date"
            className="mt-0.5 h-11 w-full rounded border px-3 text-sm"
          />
        </label>
      </div>
      {state.errors?.endDate && (
        <p className="text-negative text-xs">{state.errors.endDate[0]}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : "Crear gasto fijo"}
      </button>
    </form>
  );
}

// ─── listados por sección ────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="font-medium text-sm text-secondary-600 dark:text-secondary-300">{title}</h2>
  );
}

function PlanRowItem({ plan }: { plan: PlanRow }) {
  const [, startTransition] = useTransition();
  const single = plan.periodStart === plan.periodEnd;
  const dates = single
    ? formatDate(plan.periodStart)
    : `${formatDate(plan.periodStart)} → ${formatDate(plan.periodEnd)}`;
  return (
    <div className="flex min-h-11 items-center justify-between rounded-lg border px-4 py-2">
      <a href={`/plans/${plan.id}`} className="min-w-0 text-sm font-medium hover:underline">
        {plan.name}
        {/* Un nombre default ("Plan para el {fecha}" / "Plan de {inicio} a {fin}")
            ya trae las fechas: no repetirlas en el meta. */}
        {!plan.name.includes(formatDate(plan.periodStart)) && (
          <span className="ml-2 text-xs text-secondary-500 dark:text-secondary-400">
            {dates}
          </span>
        )}
      </a>
      <button
        type="button"
        onClick={() => {
          if (confirm(`¿Eliminar el plan "${plan.name}" y sus presupuestos?`)) {
            startTransition(() => {
              void deletePlanAction(plan.id);
            });
          }
        }}
        className="shrink-0 text-xs text-red-500 hover:underline"
      >
        Eliminar
      </button>
    </div>
  );
}

function ProjectionRowItem({ p }: { p: ProjectionView }) {
  const [pending, startTransition] = useTransition();
  const isPending = p.status === "projected";
  const diff = p.realPesos - p.expectedPesos;
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{p.concept ?? "Ingreso proyectado"}</p>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            {/* medianoche UTC del día capturado → formatear en UTC (cf. ReconcileList) */}
            {new Date(p.occurredAt).toLocaleDateString("es-MX", { timeZone: "UTC" })} ·{" "}
            {p.accountName}
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
            isPending
              ? "bg-mustard-100 text-mustard-700 dark:bg-mustard-900 dark:text-mustard-300"
              : "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
          }`}
        >
          {isPending ? "Pendiente" : "Conciliada"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-sm">
          {isPending ? (
            <>Esperado: {formatMXN(p.expectedPesos)}</>
          ) : (
            <>
              Esperado {formatMXN(p.expectedPesos)} · Real {formatMXN(p.realPesos)}
              {diff !== 0 && (
                <span
                  className={
                    diff > 0
                      ? "ml-1 text-primary-700 dark:text-primary-300"
                      : "ml-1 text-negative dark:text-red-400"
                  }
                >
                  ({diff > 0 ? "+" : ""}
                  {formatMXN(diff)})
                </span>
              )}
            </>
          )}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Eliminar la proyección "${p.concept ?? "Ingreso proyectado"}"?`)) {
              startTransition(() => {
                void deleteProjectionAction(p.id);
              });
            }
          }}
          className="shrink-0 text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function FixedExpenseRowItem({ f }: { f: FixedExpenseView }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{f.name}</p>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            Día {f.dayOfMonth} · {f.accountName} · {f.categoryName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{formatMXN(f.amountPesos)}</p>
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${
              f.isActive
                ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                : "bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300"
            }`}
          >
            {f.isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-secondary-500 dark:text-secondary-400">
          {f.isActive && f.nextDate
            ? `Próximo cargo: ${formatDate(f.nextDate)}`
            : f.isActive
              ? "Vigencia terminada"
              : "En pausa"}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void setFixedExpenseActiveAction(f.id, !f.isActive);
              })
            }
            className="text-xs text-primary-700 hover:underline disabled:opacity-50 dark:text-primary-400"
          >
            {f.isActive ? "Pausar" : "Reanudar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  `¿Eliminar el gasto fijo "${f.name}"? Los cargos ya registrados se conservan.`
                )
              ) {
                startTransition(() => {
                  void deleteFixedExpenseAction(f.id);
                });
              }
            }}
            className="text-xs text-red-500 hover:underline disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── manager ─────────────────────────────────────────────────────────────────

export function PlanList({ data }: { data: PlansPageData }) {
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const back = () => setPlanType(null);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <SectionHeader title="Presupuestos" />
        {data.plans.length === 0 && (
          <p className="text-sm text-secondary-500 dark:text-secondary-400">
            Sin presupuestos todavía.
          </p>
        )}
        {data.plans.map((p) => (
          <PlanRowItem key={p.id} plan={p} />
        ))}
      </section>

      <section className="space-y-2">
        <SectionHeader title="Proyecciones de ingreso" />
        {data.projections.length === 0 && (
          <p className="text-sm text-secondary-500 dark:text-secondary-400">
            Sin proyecciones todavía.
          </p>
        )}
        {data.projections.map((p) => (
          <ProjectionRowItem key={p.id} p={p} />
        ))}
      </section>

      <section className="space-y-2">
        <SectionHeader title="Gastos fijos" />
        {data.fixedExpenses.length === 0 && (
          <p className="text-sm text-secondary-500 dark:text-secondary-400">
            Sin gastos fijos todavía.
          </p>
        )}
        {data.fixedExpenses.map((f) => (
          <FixedExpenseRowItem key={f.id} f={f} />
        ))}
      </section>

      {planType === null && <TypeSelector onSelect={setPlanType} />}
      {planType === "budget" && <BudgetPlanForm onBack={back} />}
      {planType === "projection" && (
        <ProjectionForm accounts={data.accounts} onBack={back} />
      )}
      {planType === "fixed" && (
        <FixedExpenseForm
          accounts={data.accounts}
          fixedCategories={data.fixedCategories}
          onBack={back}
        />
      )}
    </div>
  );
}
