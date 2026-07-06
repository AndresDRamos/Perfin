import Link from "next/link";
import { getAccountsPage } from "@/app/actions/accounts";
import { Logo } from "@/app/components/Logo";
import { AccountManager } from "./AccountManager";

export default async function AccountsPage() {
  const accounts = await getAccountsPage();

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={22} withWordmark={false} />
          <h1 className="text-2xl font-semibold">Cuentas</h1>
        </div>
        <Link href="/" className="text-sm text-primary-700 hover:underline dark:text-primary-400">
          ← Inicio
        </Link>
      </div>
      <AccountManager accounts={accounts} />
    </main>
  );
}
