import Link from "next/link";
import { getPlansPage } from "@/app/actions/budgets";
import { PlanList } from "./PlanList";

export default async function PlansPage() {
  const { plans } = await getPlansPage();

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planes y presupuestos</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Inicio
        </Link>
      </div>

      <PlanList plans={plans} />
    </main>
  );
}
