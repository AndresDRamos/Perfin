"use client";

import { useState, useTransition } from "react";
import { reconcileProjectionAction } from "@/app/actions/ledger";

export interface DueProjection {
  id: number;
  concept: string | null;
  occurredAtISO: string; // serializado para cruzar el límite server→client
  expectedPesos: number;
  accountName: string;
}

function formatMXN(pesos: number) {
  return pesos.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function ReconcileRow({ projection }: { projection: DueProjection }) {
  // Prellenado con el esperado: conciliar sin tocar el monto = "llegó lo esperado".
  const [value, setValue] = useState(projection.expectedPesos.toString());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const realPesos = Number(value);
    if (!(realPesos > 0)) {
      setError("Monto inválido");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await reconcileProjectionAction(projection.id, realPesos);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="space-y-1.5 rounded-lg border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {projection.concept ?? "Ingreso proyectado"}
          </p>
          <p className="text-xs text-text-muted">
            {/* occurred_at se guarda como medianoche UTC del día capturado;
                formatear en UTC evita mostrar el día anterior en TZ México. */}
            {new Date(projection.occurredAtISO).toLocaleDateString("es-MX", {
              timeZone: "UTC",
            })}{" "}
            · {projection.accountName}
          </p>
        </div>
        <p className="shrink-0 text-sm text-secondary-600 dark:text-secondary-300">
          Esperado {formatMXN(projection.expectedPesos)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Monto real recibido"
          className="h-11 w-full flex-1 rounded border px-3 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-11 shrink-0 rounded bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : "Conciliar"}
        </button>
      </div>
      {error && <p className="text-xs text-negative">{error}</p>}
    </div>
  );
}

export function ReconcileList({ projections }: { projections: DueProjection[] }) {
  if (projections.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm text-secondary-600 dark:text-secondary-300">
        Por conciliar
      </h3>
      {projections.map((p) => (
        <ReconcileRow key={p.id} projection={p} />
      ))}
    </div>
  );
}
