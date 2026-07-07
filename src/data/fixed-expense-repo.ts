import { and, eq, lte } from "drizzle-orm";
import { db } from "./db";
import { fixedExpense, ledgerEntry, FixedExpenseRow } from "./schema";
import { occurrencesBetween } from "@/domain/recurrence";

export async function listFixedExpenses(userId: string): Promise<FixedExpenseRow[]> {
  return db
    .select()
    .from(fixedExpense)
    .where(eq(fixedExpense.userId, userId))
    .orderBy(fixedExpense.name);
}

// Motor de materialización lazy (se invoca al cargar dashboard y /plans).
// Cada ocurrencia vencida de una plantilla activa se convierte en un
// ledger_entry kind=expense status=cleared fechado en su día programado (los
// servicios se cargan solos: la deuda aparece de inmediato en el saldo).
// Idempotente vía el unique parcial uq_ledger_entry_fixed_expense_month +
// ON CONFLICT DO NOTHING: correr dos veces el mismo día es un no-op, y un
// catch-up de varios meses inserta solo los meses que faltan.
// `today` es la fecha local del servidor en ISO (YYYY-MM-DD).
export async function materializeDueFixedExpenses(
  userId: string,
  today: string
): Promise<number> {
  const templates = await db
    .select()
    .from(fixedExpense)
    .where(
      and(
        eq(fixedExpense.userId, userId),
        eq(fixedExpense.isActive, true),
        lte(fixedExpense.startDate, today)
      )
    );

  let inserted = 0;
  for (const t of templates) {
    const due = occurrencesBetween(
      { dayOfMonth: t.dayOfMonth, startDate: t.startDate, endDate: t.endDate },
      t.startDate,
      today
    );
    if (due.length === 0) continue;

    const rows = await db
      .insert(ledgerEntry)
      .values(
        due.map((occ) => ({
          userId,
          kind: "expense" as const,
          status: "cleared" as const,
          amount: t.amount,
          concept: t.name,
          // Medianoche UTC del día programado — misma convención que el alta
          // manual (z.coerce.date sobre un input type=date).
          occurredAt: new Date(occ.date),
          accountId: t.accountId,
          expenseCategoryId: t.expenseCategoryId,
          fixedExpenseId: t.id,
          fixedExpenseMonth: occ.month,
        }))
      )
      .onConflictDoNothing()
      .returning({ id: ledgerEntry.id });
    inserted += rows.length;
  }
  return inserted;
}

// Fecha local del servidor como ISO YYYY-MM-DD (un solo TZ para v1 — ver
// riesgo de fechas en STATE).
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
