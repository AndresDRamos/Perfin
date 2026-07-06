"use server";

import { revalidatePath } from "next/cache";
import {
  fixedExpenseCreateSchema,
  fixedExpenseUpdateSchema,
  createFixedExpense,
  updateFixedExpense,
  setFixedExpenseActive,
  deleteFixedExpense,
} from "@/data/fixed-expense-write";
import { requireSessionUser } from "@/data/auth-repo";

export async function createFixedExpenseAction(raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = fixedExpenseCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const row = await createFixedExpense(userId, parsed.data);
    revalidatePath("/plans");
    revalidatePath("/");
    return { ok: true as const, id: row.id };
  } catch (e) {
    return {
      ok: false as const,
      errors: {
        expenseCategoryId: [e instanceof Error ? e.message : "Error al crear el gasto fijo"],
      },
    };
  }
}

export async function updateFixedExpenseAction(id: number, raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = fixedExpenseUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  await updateFixedExpense(userId, id, parsed.data);
  revalidatePath("/plans");
  revalidatePath("/");
  return { ok: true as const, id };
}

export async function setFixedExpenseActiveAction(id: number, isActive: boolean) {
  const { userId } = await requireSessionUser();
  await setFixedExpenseActive(userId, id, isActive);
  revalidatePath("/plans");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteFixedExpenseAction(id: number) {
  const { userId } = await requireSessionUser();
  await deleteFixedExpense(userId, id);
  revalidatePath("/plans");
  return { ok: true as const };
}
