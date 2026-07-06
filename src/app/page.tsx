import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@iconify/react";
import { getDashboard } from "@/app/actions/ledger";
import { logOutAction } from "@/app/actions/auth";
import { requireSessionUser } from "@/data/auth-repo";
import { listAccountsWithBalances } from "@/data/account-repo";
import { CaptureForm } from "@/app/components/CaptureForm";
import { format, toPesos } from "@/domain/money";
import { money } from "@/domain/money";
import {
  listActiveIncomeCategories,
  listActiveExpenseCategories,
} from "@/data/category-repo";
import { ACCOUNT_KIND_META, accountKindTextClass, type AccountKind } from "@/lib/branding/account-kind";

function formatMXN(pesos: number) {
  return format(money(Math.round(pesos * 100)));
}

const LIQUID_KINDS: AccountKind[] = ["cash", "debit", "investment"];

export default async function Home() {
  const sessionUser = await requireSessionUser();
  const [dashboard, accountViews, incomeCategories, expenseCategories] = await Promise.all([
    getDashboard(),
    listAccountsWithBalances(sessionUser.userId),
    listActiveIncomeCategories(),
    listActiveExpenseCategories(),
  ]);
  const accounts = accountViews.filter((v) => v.account.isActive).map((v) => v.account);

  // First-run guide: a brand-new user has 0 active accounts — send them
  // through the onboarding wizard instead of an empty dashboard.
  if (accounts.length === 0) {
    redirect("/onboarding");
  }

  // "Patrimonio por tipo": real (cleared-only) balance grouped by kind, same
  // liquid composition as the "Real" available figure above (cash+debit+
  // investment) — credit is a liability, shown separately in its own section.
  const netWorthByKind = LIQUID_KINDS.map((kind) => ({
    kind,
    totalPesos: accountViews
      .filter((v) => v.account.isActive && v.account.kind === kind)
      .reduce((sum, v) => sum + toPesos(v.balance), 0),
  })).filter((row) => row.totalPesos !== 0);
  const netWorthTotal = netWorthByKind.reduce((sum, row) => sum + row.totalPesos, 0);

  // dashboard.creditCards.owedPesos is scoped to the *current open statement*
  // (ADR-004, pay-in-full: periods before the current cutoff are deliberately
  // excluded — see currentStatementOwed). That is not "how much I owe on this
  // card" for a card whose debt was set via opening_balance or predates the
  // current cutoff — the account's real total balance (same figure /accounts
  // shows) is. Look it up from the balances we already fetched above instead
  // of introducing a second, inconsistent number. Negated like
  // currentStatementOwed does: the signed balance is negative when in debt,
  // but "owed" is conventionally shown as a positive amount.
  const creditBalanceByAccountId = new Map(
    accountViews
      .filter((v) => v.account.kind === "credit")
      .map((v) => [v.account.id, -toPesos(v.balance)])
  );

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
          <Link href="/profile" className="text-gray-500 hover:underline">
            {sessionUser.username}
          </Link>
          <form action={logOutAction}>
            <button type="submit" className="text-gray-500 hover:underline">
              Salir
            </button>
          </form>
        </nav>
      </div>

      {/* ── Dashboard ── */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Disponible</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-secondary-600 dark:text-secondary-300 uppercase tracking-wide">Real</p>
            <p className="mt-1 text-2xl font-bold">{formatMXN(dashboard.realAvailablePesos)}</p>
            <p className="text-xs text-gray-400">Solo transacciones confirmadas</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-secondary-600 dark:text-secondary-300 uppercase tracking-wide">Proyectado</p>
            <p className="mt-1 text-2xl font-bold">{formatMXN(dashboard.projectedAvailablePesos)}</p>
            <p className="text-xs text-gray-400">Incluye ingresos proyectados</p>
          </div>
        </div>

        {netWorthByKind.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-secondary-600 dark:text-secondary-300">
              Patrimonio por tipo
            </h3>
            <div className="space-y-1.5 rounded-lg border p-3">
              {netWorthByKind.map(({ kind, totalPesos }) => {
                const meta = ACCOUNT_KIND_META[kind];
                const share = netWorthTotal !== 0 ? Math.max(totalPesos, 0) / netWorthTotal : 0;
                return (
                  <div key={kind} className="flex items-center gap-2.5">
                    <Icon icon={meta.icon} className={`h-4 w-4 shrink-0 ${accountKindTextClass(kind)}`} />
                    <span className="w-16 shrink-0 text-xs text-secondary-600 dark:text-secondary-300">
                      {meta.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary-100 dark:bg-secondary-800">
                      <div
                        className={`h-full rounded-full ${meta.barClass}`}
                        style={{ width: `${Math.round(share * 100)}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs font-medium">
                      {formatMXN(totalPesos)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {dashboard.creditCards.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-secondary-600 dark:text-secondary-300">
              Tarjetas de crédito
            </h3>
            {dashboard.creditCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ACCOUNT_KIND_META.credit.bgSoft}`}
                  >
                    <Icon icon={ACCOUNT_KIND_META.credit.icon} className={`h-4 w-4 ${accountKindTextClass("credit")}`} />
                  </span>
                  <div>
                    <p className="font-medium text-sm">{card.name}</p>
                    <p className="text-xs text-gray-400">
                      Vence {card.nextDue.toLocaleDateString("es-MX")}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-red-600">
                  {formatMXN(creditBalanceByAccountId.get(card.id) ?? card.owedPesos)}
                </p>
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
