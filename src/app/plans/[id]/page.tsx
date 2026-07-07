import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlanDetail } from "@/app/actions/budgets";
import { BudgetManager } from "./BudgetManager";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId) || planId <= 0) notFound();

  const detail = await getPlanDetail(planId);
  if (!detail) notFound();

  const { progress, expenseCategories, accounts } = detail;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8 sm:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{progress.plan.name}</h1>
          <p className="text-sm text-gray-400">
            {progress.plan.periodStart} → {progress.plan.periodEnd}
          </p>
        </div>
        <Link
          href="/plans"
          className="text-sm text-primary-700 hover:underline dark:text-primary-400"
        >
          ← Planes
        </Link>
      </div>

      <BudgetManager
        planId={planId}
        progress={progress.budgets}
        expenseCategories={expenseCategories}
        accounts={accounts}
      />
    </main>
  );
}
