import { getCategoriesPage } from "@/app/actions/catalog";
import { CategoryList } from "./CategoryList";

export default async function CategoriesPage() {
  const { incomeCategories, expenseCategories } = await getCategoriesPage();

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <a href="/" className="text-sm text-blue-600 hover:underline">
          ← Inicio
        </a>
      </div>

      <CategoryList
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
      />
    </main>
  );
}
