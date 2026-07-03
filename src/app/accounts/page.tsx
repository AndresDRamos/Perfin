import Link from "next/link";
import { getAccountsPage } from "@/app/actions/accounts";
import { AccountManager } from "./AccountManager";

export default async function AccountsPage() {
  const accounts = await getAccountsPage();

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cuentas</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Inicio
        </Link>
      </div>
      <AccountManager accounts={accounts} />
    </main>
  );
}
