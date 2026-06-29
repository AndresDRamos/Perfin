"use client";

import { useState, useTransition, useActionState } from "react";
import { captureEntry } from "@/app/actions/ledger";

type Kind = "income" | "expense" | "transfer";

interface Account {
  id: number;
  name: string;
  kind: string;
}

interface Props {
  accounts: Account[];
}

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

async function submitCapture(_prev: FormState, formData: FormData): Promise<FormState> {
  const kind = formData.get("kind") as Kind;
  const raw = {
    kind,
    amountPesos: Number(formData.get("amountPesos")),
    concept: formData.get("concept") || undefined,
    occurredAt: formData.get("occurredAt"),
    status: formData.get("status"),
    accountId: Number(formData.get("accountId")),
    toAccountId:
      kind === "transfer" ? Number(formData.get("toAccountId")) : undefined,
  };
  return captureEntry(raw);
}

export function CaptureForm({ accounts }: Props) {
  const [kind, setKind] = useState<Kind>("expense");
  const [state, action, pending] = useActionState(submitCapture, {});

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold text-lg">Captura rápida</h2>

      {/* kind */}
      <div className="flex gap-2">
        {(["expense", "income", "transfer"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded px-3 py-1 text-sm ${
              kind === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            {k === "expense" ? "Gasto" : k === "income" ? "Ingreso" : "Transferencia"}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />

      {/* amount */}
      <div>
        <label className="block text-sm font-medium">Monto (MXN)</label>
        <input
          name="amountPesos"
          type="number"
          min="0.01"
          step="0.01"
          required
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
          placeholder="0.00"
        />
        {state.errors?.amountPesos && (
          <p className="text-red-600 text-xs mt-1">{state.errors.amountPesos[0]}</p>
        )}
      </div>

      {/* concept */}
      <div>
        <label className="block text-sm font-medium">Concepto</label>
        <input
          name="concept"
          type="text"
          maxLength={200}
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
          placeholder="Descripción opcional"
        />
      </div>

      {/* occurredAt */}
      <div>
        <label className="block text-sm font-medium">Fecha</label>
        <input
          name="occurredAt"
          type="date"
          defaultValue={today}
          required
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        />
      </div>

      {/* status */}
      <div>
        <label className="block text-sm font-medium">Estado</label>
        <select
          name="status"
          defaultValue="cleared"
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        >
          <option value="cleared">Confirmado</option>
          <option value="projected">Proyectado</option>
        </select>
      </div>

      {/* accountId */}
      <div>
        <label className="block text-sm font-medium">Cuenta</label>
        <select
          name="accountId"
          required
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.kind})
            </option>
          ))}
        </select>
      </div>

      {/* toAccountId — only for transfers */}
      {kind === "transfer" && (
        <div>
          <label className="block text-sm font-medium">Cuenta destino</label>
          <select
            name="toAccountId"
            required
            className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.kind})
              </option>
            ))}
          </select>
          {state.errors?.toAccountId && (
            <p className="text-red-600 text-xs mt-1">{state.errors.toAccountId[0]}</p>
          )}
        </div>
      )}

      {state.ok === true && (
        <p className="text-green-700 text-sm">Transacción registrada.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
