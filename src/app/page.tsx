import { getDashboard } from "@/app/actions/ledger";
import { db } from "@/data/db";
import { account } from "@/data/schema";
import { eq } from "drizzle-orm";
import { CaptureForm } from "@/app/components/CaptureForm";
import { format } from "@/domain/money";
import { money } from "@/domain/money";
import {
  listActiveIncomeCategories,
  listActiveExpenseCategories,
} from "@/data/category-repo";

function formatMXN(pesos: number) {
  return format(money(Math.round(pesos * 100)));
}

export default async function Home() {
  const [dashboard, accounts, incomeCategories, expenseCategories] = await Promise.all([
    getDashboard(),
    db.select().from(account).where(eq(account.isActive, true)),
    listActiveIncomeCategories(),
    listActiveExpenseCategories(),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perfin</h1>
        <a href="/categories" className="text-sm text-blue-600 hover:underline">
          Categorías →
        </a>
      </div>

      {/* ── Dashboard ── */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Disponible</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Real</p>
            <p className="mt-1 text-2xl font-bold">{formatMXN(dashboard.realAvailablePesos)}</p>
            <p className="text-xs text-gray-400">Solo transacciones confirmadas</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Proyectado</p>
            <p className="mt-1 text-2xl font-bold">{formatMXN(dashboard.projectedAvailablePesos)}</p>
            <p className="text-xs text-gray-400">Incluye ingresos proyectados</p>
          </div>
        </div>

        {dashboard.creditCards.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-gray-700">Tarjetas de crédito</h3>
            {dashboard.creditCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{card.name}</p>
                  <p className="text-xs text-gray-400">
                    Vence {card.nextDue.toLocaleDateString("es-MX")}
                  </p>
                </div>
                <p className="font-semibold text-red-600">{formatMXN(card.owedPesos)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Capture form ── */}
      <CaptureForm
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        incomeCategories={incomeCategories.map((c) => ({ id: c.id, name: c.name }))}
        expenseCategories={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </main>
  );
}
