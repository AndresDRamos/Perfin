"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireSessionUser } from "@/data/auth-repo";
import {
  incomeScheduleSchema,
  createIncomeSchedule,
  updateIncomeSchedule,
  deactivateIncomeSchedule,
} from "@/data/income-schedule-write";
import { listAllIncomeSchedules } from "@/data/income-schedule-repo";
import { createEntry } from "@/data/ledger-write";
import { db } from "@/data/db";
import { incomeSchedule, ledgerEntry } from "@/data/schema";
import { addDays } from "@/domain/dates";

export async function createIncomeScheduleAction(raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = incomeScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await createIncomeSchedule(userId, parsed.data);
  revalidatePath("/");
  return { ok: true as const, id: row.id };
}

export async function updateIncomeScheduleAction(id: number, raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = incomeScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await updateIncomeSchedule(userId, id, parsed.data);
  revalidatePath("/");
  return { ok: true as const, id: row.id };
}

export async function deactivateIncomeScheduleAction(id: number) {
  const { userId } = await requireSessionUser();
  await deactivateIncomeSchedule(userId, id);
  revalidatePath("/");
  return { ok: true as const };
}

export async function listIncomeSchedulesAction() {
  const { userId } = await requireSessionUser();
  return listAllIncomeSchedules(userId);
}

// ─── payday confirmation ──────────────────────────────────────────────────────
// On (or after) a scheduled payday the dashboard asks for the REAL amount and
// writes the income as a cleared ledger_entry. The schedule's estimate never
// enters the ledger.

const confirmPaydaySchema = z.object({
  scheduleId: z.number().int().positive(),
  realAmountPesos: z.number().positive({ message: "El monto debe ser mayor a 0" }),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida" }),
});

// Same window the dashboard uses to decide a payday is pending: a real income
// on the schedule's account within ±PAYDAY_DEDUPE_DAYS of the occurrence
// counts as "already registered".
const PAYDAY_DEDUPE_DAYS = 3;

export async function confirmPaydayAction(raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = confirmPaydaySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const { scheduleId, realAmountPesos, occurredOn } = parsed.data;

  const [schedule] = await db
    .select()
    .from(incomeSchedule)
    .where(and(eq(incomeSchedule.id, scheduleId), eq(incomeSchedule.userId, userId)))
    .limit(1);
  if (!schedule) {
    return { ok: false as const, errors: { scheduleId: ["Ingreso recurrente no encontrado"] } };
  }

  // Server-side dedupe (the UI check is only cosmetic): refuse a second real
  // income for the same occurrence window.
  const windowStart = addDays(occurredOn, -PAYDAY_DEDUPE_DAYS);
  const windowEnd = addDays(occurredOn, PAYDAY_DEDUPE_DAYS + 1); // exclusive
  const [existing] = await db
    .select({ id: ledgerEntry.id })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        eq(ledgerEntry.accountId, schedule.accountId),
        eq(ledgerEntry.kind, "income"),
        eq(ledgerEntry.status, "cleared"),
        gte(ledgerEntry.occurredAt, new Date(windowStart)),
        lte(ledgerEntry.occurredAt, new Date(windowEnd))
      )
    )
    .limit(1);
  if (existing) {
    return {
      ok: false as const,
      errors: { occurredOn: ["Ya hay un ingreso registrado para esta fecha de pago"] },
    };
  }

  const row = await createEntry(userId, {
    kind: "income",
    amountPesos: realAmountPesos,
    concept: schedule.name,
    occurredAt: new Date(occurredOn),
    status: "cleared",
    accountId: schedule.accountId,
    categoryId: schedule.incomeCategoryId ?? undefined,
  });
  revalidatePath("/");
  return { ok: true as const, id: row.id };
}
