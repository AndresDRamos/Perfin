"use client";

import { useState } from "react";
import {
  createIncomeScheduleAction,
  updateIncomeScheduleAction,
  deactivateIncomeScheduleAction,
} from "@/app/actions/income-schedule";
import type { AccountCardView, ScheduleView } from "@/app/actions/dashboard";
import { Modal, formatMXN, inputClass, labelClass, primaryButtonClass } from "./ui";

interface Category {
  id: number;
  name: string;
}

interface Props {
  accounts: AccountCardView[];
  incomeCategories: Category[];
  schedules: ScheduleView[];
  onClose: () => void;
}

const FREQUENCY_LABEL: Record<ScheduleView["frequency"], string> = {
  weekly: "Semanal",
  biweekly: "Catorcenal (cada 14 días)",
  semimonthly: "Quincenal (día 15 y fin de mes)",
  monthly: "Mensual",
};

// "Tipo de ingreso": the user's recurring income(s). The amount is an
// ESTIMATE — on payday the app asks for the real amount (PaydayPrompt).
export function IncomeScheduleForm({ accounts, incomeCategories, schedules, onClose }: Props) {
  const [editing, setEditing] = useState<ScheduleView | null>(null);
  const [creating, setCreating] = useState(schedules.length === 0);

  return (
    <Modal title="Ingresos recurrentes" onClose={onClose}>
      <div className="space-y-4">
        {!creating && !editing && (
          <>
            <ul className="space-y-2">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-secondary-600 dark:text-secondary-300">
                      {FREQUENCY_LABEL[s.frequency]} · ~{formatMXN(s.estimatedAmountPesos)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="shrink-0 rounded px-2 py-1.5 text-xs text-secondary-600 underline dark:text-secondary-300"
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setCreating(true)} className={primaryButtonClass}>
              + Nuevo ingreso recurrente
            </button>
          </>
        )}

        {(creating || editing) && (
          <ScheduleFields
            accounts={accounts}
            incomeCategories={incomeCategories}
            schedule={editing}
            onDone={onClose}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
              if (schedules.length === 0) onClose();
            }}
          />
        )}
      </div>
    </Modal>
  );
}

function ScheduleFields({
  accounts,
  incomeCategories,
  schedule,
  onDone,
  onCancel,
}: {
  accounts: AccountCardView[];
  incomeCategories: Category[];
  schedule: ScheduleView | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(schedule?.name ?? "");
  const [frequency, setFrequency] = useState<ScheduleView["frequency"]>(
    schedule?.frequency ?? "semimonthly"
  );
  const [amount, setAmount] = useState(schedule ? String(schedule.estimatedAmountPesos) : "");
  const [accountId, setAccountId] = useState<number | "">(schedule?.accountId ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(schedule?.incomeCategoryId ?? "");
  const [anchorDate, setAnchorDate] = useState(
    schedule?.anchorDate ?? new Date().toISOString().slice(0, 10)
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setErrors({});
    const raw = {
      name,
      frequency,
      estimatedAmountPesos: Number(amount),
      accountId: accountId === "" ? undefined : accountId,
      incomeCategoryId: categoryId === "" ? undefined : categoryId,
      anchorDate,
    };
    const res = schedule
      ? await updateIncomeScheduleAction(schedule.id, raw)
      : await createIncomeScheduleAction(raw);
    setPending(false);
    if (res.ok) onDone();
    else setErrors(res.errors ?? {});
  }

  async function deactivate() {
    if (!schedule) return;
    setPending(true);
    await deactivateIncomeScheduleAction(schedule.id);
    setPending(false);
    onDone();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Nombre</label>
        <input
          type="text"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Nómina, freelance…"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name[0]}</p>}
      </div>

      <div>
        <label className={labelClass}>Frecuencia</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ScheduleView["frequency"])}
          className={inputClass}
        >
          {(Object.keys(FREQUENCY_LABEL) as ScheduleView["frequency"][]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABEL[f]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Monto estimado (MXN)</label>
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
        <p className="mt-1 text-xs text-secondary-600 dark:text-secondary-300">
          Es un estimado: el día de pago la app te preguntará cuánto recibiste realmente.
        </p>
        {errors.estimatedAmountPesos && (
          <p className="mt-1 text-xs text-red-600">{errors.estimatedAmountPesos[0]}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Cuenta donde lo recibes</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value === "" ? "" : Number(e.target.value))}
          className={inputClass}
        >
          <option value="">Elige una cuenta</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {errors.accountId && <p className="mt-1 text-xs text-red-600">{errors.accountId[0]}</p>}
      </div>

      {incomeCategories.length > 0 && (
        <div>
          <label className={labelClass}>Categoría</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputClass}
          >
            <option value="">Sin categoría</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>Un día de pago conocido (ancla)</label>
        <input
          type="date"
          value={anchorDate}
          onChange={(e) => setAnchorDate(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-secondary-600 dark:text-secondary-300">
          A partir de esta fecha se calculan tus próximos pagos.
        </p>
        {errors.anchorDate && <p className="mt-1 text-xs text-red-600">{errors.anchorDate[0]}</p>}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className={primaryButtonClass}>
          {pending ? "Guardando…" : schedule ? "Guardar cambios" : "Crear"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded border py-2.5 text-sm text-secondary-600 dark:text-secondary-300"
        >
          Cancelar
        </button>
      </div>
      {schedule && (
        <button
          type="button"
          onClick={deactivate}
          disabled={pending}
          className="w-full rounded py-2 text-sm text-red-600 underline"
        >
          Desactivar este ingreso
        </button>
      )}
    </div>
  );
}
