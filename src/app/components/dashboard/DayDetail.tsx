"use client";

import { useState } from "react";
import { editEntry, reconcileEntry } from "@/app/actions/ledger";
import type { EntryView } from "@/app/actions/dashboard";
import { formatMXN, inputClass, labelClass, primaryButtonClass } from "./ui";

interface Props {
  date: string;
  today: string;
  entries: EntryView[];
  onCapture: () => void; // open EntryModal preset to this day
  onConfigureIncome: () => void; // open IncomeScheduleForm
}

const KIND_LABEL: Record<EntryView["kind"], string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
};

// Detail of the day picked on the timeline: its transactions (editable),
// plus creating a projected movement for that day and configuring the
// recurring income ("tipo de ingreso") from here.
export function DayDetail({ date, today, entries, onCapture, onConfigureIncome }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);

  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold capitalize">{label}</h3>
        {date > today && (
          <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] text-secondary-700 dark:bg-secondary-800 dark:text-secondary-200">
            Proyección
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          Sin movimientos para este día.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) =>
            editingId === e.id ? (
              <li key={e.id} className="rounded-md border p-2.5">
                <EditEntryForm entry={e} onDone={() => setEditingId(null)} />
              </li>
            ) : (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {e.concept || KIND_LABEL[e.kind]}
                  </p>
                  <p className="truncate text-xs text-secondary-600 dark:text-secondary-300">
                    {e.kind === "transfer"
                      ? `${e.accountName} → ${e.toAccountName}`
                      : e.accountName}
                    {e.categoryName ? ` · ${e.categoryName}` : ""}
                    {e.status === "projected" ? " · proyectado" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`text-sm font-semibold ${
                      e.kind === "expense"
                        ? "text-red-600"
                        : e.kind === "income"
                          ? "text-primary-700 dark:text-primary-400"
                          : ""
                    }`}
                  >
                    {e.kind === "expense" ? "−" : e.kind === "income" ? "+" : ""}
                    {formatMXN(e.amountPesos)}
                  </span>
                  {e.status === "projected" && (
                    <button
                      type="button"
                      onClick={() => reconcileEntry(e.id)}
                      className="rounded px-2 py-1.5 text-xs text-primary-700 underline dark:text-primary-400"
                    >
                      Confirmar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(e.id)}
                    className="rounded px-2 py-1.5 text-xs text-secondary-600 underline dark:text-secondary-300"
                  >
                    Editar
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onCapture}
          className="rounded-full bg-primary-600 px-3.5 py-2 text-sm font-medium text-white"
        >
          + Movimiento este día
        </button>
        <button
          type="button"
          onClick={onConfigureIncome}
          className="rounded-full bg-secondary-100 px-3.5 py-2 text-sm text-secondary-700 dark:bg-secondary-800 dark:text-secondary-200"
        >
          Configurar ingreso recurrente
        </button>
      </div>
    </div>
  );
}

// Inline edit: amount, concept, date, status and (for income/expense) keeping
// kind/account/category as-is — editEntry requires the full input, so the
// unchanged fields are resubmitted from the current view.
function EditEntryForm({ entry, onDone }: { entry: EntryView; onDone: () => void }) {
  const [amount, setAmount] = useState(String(entry.amountPesos));
  const [concept, setConcept] = useState(entry.concept ?? "");
  const [date, setDate] = useState(entry.date);
  const [status, setStatus] = useState(entry.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    const base = {
      amountPesos: Number(amount),
      concept: concept || undefined,
      occurredAt: date,
      status,
      accountId: entry.accountId,
    };
    const raw =
      entry.kind === "transfer"
        ? { ...base, kind: "transfer", toAccountId: entry.toAccountId }
        : { ...base, kind: entry.kind, categoryId: entry.categoryId ?? undefined };
    const res = await editEntry(entry.id, raw);
    setPending(false);
    if (res.ok) onDone();
    else setError(Object.values(res.errors ?? {}).flat()[0] ?? "No se pudo guardar");
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelClass}>Monto</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Concepto</label>
        <input
          type="text"
          maxLength={200}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EntryView["status"])}
          className={inputClass}
        >
          <option value="cleared">Confirmado</option>
          <option value="projected">Proyectado</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className={primaryButtonClass}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded border py-2.5 text-sm text-secondary-600 dark:text-secondary-300"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
