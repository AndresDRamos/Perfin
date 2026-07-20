import { requireSessionUser } from "@/data/auth-repo";
import { listActiveExpenseCategories, listActiveIncomeCategories } from "@/data/category-repo";
import { Logo } from "@/app/components/Logo";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  await requireSessionUser();
  const [expenseCategories, incomeCategories] = await Promise.all([
    listActiveExpenseCategories(),
    listActiveIncomeCategories(),
  ]);

  return (
    <main className="mx-auto max-w-sm p-6 sm:p-8">
      <Logo className="mb-8 justify-center" />
      <OnboardingWizard
        expenseCategories={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
        incomeCategories={incomeCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </main>
  );
}
