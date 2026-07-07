"use client";

import { useState } from "react";
import type { AccountCardView, DashboardV2Data } from "@/app/actions/dashboard";
import { BalanceTimeline } from "./BalanceTimeline";
import { DayDetail } from "./DayDetail";
import { EntryModal, EntryModalPreset } from "./EntryModal";
import { IncomeScheduleForm } from "./IncomeScheduleForm";
import { PaydayPrompt } from "./PaydayPrompt";
import { AccountBalanceList } from "./AccountBalanceList";
import { BudgetBars } from "./BudgetBars";
import { formatMXN } from "./ui";

// Client orchestrator: owns the selected-day and modal state and composes the
// dashboard sections (plan order: saldo actual → timeline → saldos → budgets).
export function Dashboard({ data }: { data: DashboardV2Data }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entryPreset, setEntryPreset] = useState<EntryModalPreset | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  const openAccountCapture = (account: AccountCardView) =>
    setEntryPreset({ account });

  const openDayCapture = (date: string) =>
    setEntryPreset({ date, status: date > data.today ? "projected" : "cleared" });

  const openBudgetCapture = (categoryId: number, opts: { schedule: boolean }) =>
    setEntryPreset({
      kind: "expense",
      categoryId,
      status: opts.schedule ? "projected" : "cleared",
      date: opts.schedule ? undefined : data.today,
    });

  return (
    <div className="space-y-6">
      {/* ── saldo actual ── */}
      <section className="text-center">
        <p className="text-xs uppercase tracking-wide text-secondary-600 dark:text-secondary-300">
          Saldo actual
        </p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${
            data.currentBalancePesos < 0 ? "text-red-600" : ""
          }`}
        >
          {formatMXN(data.currentBalancePesos)}
        </p>
      </section>

      {/* ── día de pago pendiente ── */}
      {data.pendingPaydays.map((p) => (
        <PaydayPrompt key={p.scheduleId} payday={p} />
      ))}

      {/* ── línea de tiempo ── */}
      <section className="space-y-3">
        <BalanceTimeline
          series={data.series}
          today={data.today}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
        {selectedDate && (
          <DayDetail
            date={selectedDate}
            today={data.today}
            entries={data.entriesByDay[selectedDate] ?? []}
            onCapture={() => openDayCapture(selectedDate)}
            onConfigureIncome={() => setShowScheduleForm(true)}
          />
        )}
      </section>

      {/* ── saldos por cuenta ── */}
      <AccountBalanceList accounts={data.accounts} onCapture={openAccountCapture} />

      {/* ── presupuestos ── */}
      <BudgetBars
        currentPlan={data.currentPlan}
        entriesByDay={data.entriesByDay}
        onCapture={openBudgetCapture}
      />

      {/* ── modales ── */}
      {entryPreset && (
        <EntryModal
          preset={entryPreset}
          accounts={data.accounts}
          incomeCategories={data.incomeCategories}
          expenseCategories={data.expenseCategories}
          onClose={() => setEntryPreset(null)}
        />
      )}
      {showScheduleForm && (
        <IncomeScheduleForm
          accounts={data.accounts}
          incomeCategories={data.incomeCategories}
          schedules={data.schedules}
          onClose={() => setShowScheduleForm(false)}
        />
      )}
    </div>
  );
}
