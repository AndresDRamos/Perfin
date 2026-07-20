"use client";

import { useState } from "react";
import { confirmPaydayAction } from "@/app/actions/income-schedule";
import type { PendingPayday } from "@/app/actions/dashboard";
import { formatMXN, inputClass } from "./ui";

// Payday arrived: ask the REAL amount and write it as a cleared income.
// The schedule's estimate never enters the ledger.
export function PaydayPrompt({ payday }: { payday: PendingPayday }) {
  const [amount, setAmount] = useState(String(payday.estimatedAmountPesos));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dateLabel = new Date(`${payday.date}T00:00:00Z`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  async function confirm() {
    setPending(true);
    setError(null);
    const res = await confirmPaydayAction({
      scheduleId: payday.scheduleId,
      realAmountPesos: Number(amount),
      occurredOn: payday.date,
    });
    setPending(false);
    if (!res.ok) {
      setError(Object.values(res.errors ?? {}).flat()[0] ?? "No se pudo registrar");
    }
    // On success revalidatePath refreshes the dashboard and the prompt goes away.
  }

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-primary-500 p-3">
      <p className="text-sm font-medium">
        💰 Día de pago: {payday.scheduleName} ({dateLabel})
      </p>
      <p className="text-xs text-secondary-600 dark:text-secondary-300">
        ¿Cuánto recibiste realmente en {payday.accountName}? Estimabas{" "}
        {formatMXN(payday.estimatedAmountPesos)}.
      </p>
      <div className="flex items-stretch gap-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClass} mt-0 flex-1`}
        />
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="shrink-0 rounded bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : "Registrar"}
        </button>
      </div>
      {error && <p className="text-xs text-negative">{error}</p>}
    </div>
  );
}
