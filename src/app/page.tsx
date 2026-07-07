import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboard } from "@/app/actions/ledger";
import { getDashboardV2 } from "@/app/actions/dashboard";
import { logOutAction } from "@/app/actions/auth";
import { requireSessionUser } from "@/data/auth-repo";
import { Dashboard } from "@/app/components/dashboard/Dashboard";
import { ReconcileList } from "@/app/components/ReconcileList";

export default async function Home() {
  const sessionUser = await requireSessionUser();
  // Sequential, not Promise.all: getDashboard() lazily materializes due fixed
  // expenses (materializeDueFixedExpenses) before reading — getDashboardV2's
  // ledger reads must run AFTER that write commits, or today's materialized
  // entries could be missing from the balance timeline.
  const legacyDashboard = await getDashboard();
  const data = await getDashboardV2();

  // First-run guide: a brand-new user has 0 active accounts — send them
  // through the onboarding wizard instead of an empty dashboard.
  if (data.accounts.length === 0) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold">Perfin</h1>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-primary-700 dark:text-primary-400">
          <Link href="/accounts" className="hover:underline">
            Cuentas →
          </Link>
          <Link href="/plans" className="hover:underline">
            Planes →
          </Link>
          <Link href="/categories" className="hover:underline">
            Categorías →
          </Link>
          <Link href="/profile" className="text-secondary-600 hover:underline dark:text-secondary-300">
            {sessionUser.username}
          </Link>
          <form action={logOutAction}>
            <button
              type="submit"
              className="text-secondary-600 hover:underline dark:text-secondary-300"
            >
              Salir
            </button>
          </form>
        </nav>
      </div>

      {/* Proyecciones de ingreso vencidas (plan tipo "Proyección") por conciliar
          antes que nada — necesitan el monto real del usuario. */}
      <ReconcileList
        projections={legacyDashboard.dueProjections.map((p) => ({
          id: p.id,
          concept: p.concept,
          occurredAtISO: p.occurredAt.toISOString(),
          expectedPesos: p.expectedPesos,
          accountName: p.accountName,
        }))}
      />

      <Dashboard data={data} />
    </main>
  );
}
