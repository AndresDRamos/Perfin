import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { incomeSchedule, IncomeScheduleRow } from "./schema";

// Hot read (dashboard projection): served by the partial index
// idx_income_schedule_user_active.
export async function listActiveIncomeSchedules(userId: string): Promise<IncomeScheduleRow[]> {
  return db
    .select()
    .from(incomeSchedule)
    .where(and(eq(incomeSchedule.userId, userId), eq(incomeSchedule.isActive, true)))
    .orderBy(incomeSchedule.name);
}

// Settings/config listing, includes inactive schedules.
export async function listAllIncomeSchedules(userId: string): Promise<IncomeScheduleRow[]> {
  return db
    .select()
    .from(incomeSchedule)
    .where(eq(incomeSchedule.userId, userId))
    .orderBy(incomeSchedule.name);
}
