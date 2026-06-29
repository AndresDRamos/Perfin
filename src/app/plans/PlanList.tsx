"use client";

import { useActionState, useTransition } from "react";
import { createPlanAction, deletePlanAction } from "@/app/actions/budgets";
import type { PlanRow } from "@/data/schema";

interface Props {
  plans: PlanRow[];
}

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

function NewPlanForm() {
  const [state, action, pending] = useActionState(
    async (_prev: FormState, fd: FormData): Promise<FormState> =>
      createPlanAction({
        name: fd.get("name"),
        periodStart: fd.get("periodStart"),
        periodEnd: fd.get("periodEnd"),
      }),
    {} as FormState
  );

  return (
    <form action={action} className="space-y-2 rounded-lg border p-4">
      <h2 className="font-semibold text-base">Nuevo plan</h2>
      <div>
        <input
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder="Nombre del plan"
          className="w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.name && (
          <p className="text-red-600 text-xs mt-0.5">{state.errors.name[0]}</p>
        )}
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-gray-500">
          Inicio
          <input
            name="periodStart"
            type="date"
            required
            className="mt-0.5 w-full rounded border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex-1 text-xs text-gray-500">
          Fin
          <input
            name="periodEnd"
            type="date"
            required
            className="mt-0.5 w-full rounded border px-3 py-1.5 text-sm"
          />
        </label>
      </div>
      {state.errors?.periodEnd && (
        <p className="text-red-600 text-xs">{state.errors.periodEnd[0]}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {pending ? "…" : "Crear plan"}
      </button>
    </form>
  );
}

function PlanRowItem({ plan }: { plan: PlanRow }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-2">
      <a href={`/plans/${plan.id}`} className="text-sm font-medium hover:underline">
        {plan.name}
        <span className="ml-2 text-xs text-gray-400">
          {plan.periodStart} → {plan.periodEnd}
        </span>
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
        className="text-xs text-red-500 hover:underline"
      >
        Eliminar
      </button>
    </div>
  );
}

export function PlanList({ plans }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        {plans.length === 0 && (
          <p className="text-sm text-gray-400">Sin planes todavía.</p>
        )}
        {plans.map((p) => (
          <PlanRowItem key={p.id} plan={p} />
        ))}
      </div>
      <NewPlanForm />
    </div>
  );
}
