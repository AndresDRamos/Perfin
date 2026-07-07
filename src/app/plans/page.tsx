import Link from "next/link";
import { getPlansPage } from "@/app/actions/budgets";
import { PlanList } from "./PlanList";

export default async function PlansPage() {
  const data = await getPlansPage();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8 sm:space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planes</h1>
        <Link
          href="/"
          className="text-sm text-primary-700 hover:underline dark:text-primary-400"
        >
          ← Inicio
        </Link>
      </div>

      <PlanList data={data} />
    </main>
  );
}
