"use server";

import { revalidatePath } from "next/cache";
import {
  accountCreateSchema,
  accountUpdateSchema,
  createAccount,
  updateAccount,
  deactivateAccount,
  reactivateAccount,
  accountNameExists,
} from "@/data/account-write";
import { listAccountsWithBalances } from "@/data/account-repo";
import { toPesos } from "@/domain/money";
import type { Account } from "@/data/schema";

function revalidateAccountViews() {
  revalidatePath("/accounts");
  revalidatePath("/"); // dashboard lists active accounts + credit cards
}

export async function createAccountAction(raw: unknown) {
  const parsed = accountCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  if (await accountNameExists(parsed.data.name)) {
    return { ok: false as const, errors: { name: ["Ya existe una cuenta con ese nombre"] } };
  }
  const row = await createAccount(parsed.data);
  revalidateAccountViews();
  return { ok: true as const, id: row.id };
}

export async function updateAccountAction(id: number, raw: unknown) {
  const parsed = accountUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.name && (await accountNameExists(parsed.data.name, id))) {
    return { ok: false as const, errors: { name: ["Ya existe una cuenta con ese nombre"] } };
  }
  try {
    const row = await updateAccount(id, parsed.data);
    revalidateAccountViews();
    return { ok: true as const, id: row.id };
  } catch (e) {
    return {
      ok: false as const,
      errors: { _form: [e instanceof Error ? e.message : "Error al actualizar"] },
    };
  }
}

export async function deactivateAccountAction(id: number) {
  await deactivateAccount(id);
  revalidateAccountViews();
  return { ok: true as const };
}

export async function reactivateAccountAction(id: number) {
  await reactivateAccount(id);
  revalidateAccountViews();
  return { ok: true as const };
}

// ─── reads ────────────────────────────────────────────────────────────────────

export interface AccountView {
  account: Account;
  balancePesos: number; // derived — Money doesn't cross the client boundary
}

export async function getAccountsPage(): Promise<AccountView[]> {
  const rows = await listAccountsWithBalances();
  return rows.map((r) => ({ account: r.account, balancePesos: toPesos(r.balance) }));
}
