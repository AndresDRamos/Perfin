"use client";

import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import type { AccountCardView, DashboardV2Data, EntryView } from "@/app/actions/dashboard";
import { ACCOUNT_KIND_META, type AccountKind } from "@/lib/branding/account-kind";
import { StatDisplay } from "@/app/components/ui/StatDisplay";
import { ExpandableRow, type KitTx, type RowAction } from "@/app/components/ui/ExpandableRow";
import { KIND_ACCENT, circleBtn, humanDateLabel, rectOf, type Accent, type OriginRect } from "@/app/components/ui/kit";
import { BalanceTimeline } from "./BalanceTimeline";
import { IncomeScheduleForm } from "./IncomeScheduleForm";
import { PaydayPrompt } from "./PaydayPrompt";
import { TransactionsView, type TxViewProgress } from "./TransactionsView";
import { NewAccountModal } from "./NewAccountModal";
import { NewBudgetModal } from "./NewBudgetModal";
import { NewTransactionModal, type TxPreset } from "./NewTransactionModal";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { kitTxForAccount, kitTxForCategory } from "./entry-kit";
import { formatMXN } from "./ui";

// Orden fijo de tipos (decisión del plan accounts): efectivo → débito →
// inversión → crédito.
const KIND_ORDER: AccountKind[] = ["cash", "debit", "investment", "credit"];

interface ContextPill {
  icon?: string;
  label: string;
  value: string;
}

type ModalState =
  | { type: "account"; origin: OriginRect }
  | { type: "editAccount"; origin: OriginRect; account: AccountCardView }
  | { type: "budget"; origin: OriginRect }
  | {
      type: "editBudget";
      origin: OriginRect;
      editing: { budgetId: number; categoryId: number; categoryName: string; targetPesos: number };
    }
  | { type: "tx"; origin: OriginRect; preset: TxPreset; context: ContextPill[] }
  | { type: "txDetail"; origin: OriginRect; entry: EntryView };

interface TxViewState {
  origin: OriginRect;
  frame: { left: number; width: number };
  icon?: string;
  accent?: Accent;
  title: string;
  total?: string;
  totalNegative?: boolean;
  columnLabel: string;
  progress?: TxViewProgress;
  transactions: KitTx[];
  actions: RowAction[];
  entriesById: Map<number, EntryView>;
}

// Orquestador cliente del dashboard (estructura del kit): saldo actual →
// timeline → Cuentas expandibles → Presupuestos, con captura contextual vía
// modales morph y vista completa de transacciones con container-transform.
export function Dashboard({ data }: { data: DashboardV2Data }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [txView, setTxView] = useState<TxViewState | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const closeModal = () => setModal(null);

  // Geometría de la columna del dashboard: la vista de transacciones cubre el
  // <main> completo (la app es una sola columna mobile-first).
  function measureFrame(): { left: number; width: number } {
    const el = rootRef.current;
    if (!el) return { left: 0, width: window.innerWidth };
    const main = el.closest("main") ?? el;
    const r = main.getBoundingClientRect();
    return { left: r.left, width: r.width };
  }

  // Origen del morph: el encabezado de la fila tocada (botón o [role=button]).
  function rowOrigin(id: string): OriginRect | null {
    const wrap = rowRefs.current[id];
    const headerEl = wrap && wrap.querySelector('button, [role="button"]');
    const el = headerEl || wrap;
    return el ? rectOf(el) : null;
  }

  const openDetail = (entry: EntryView, e: MouseEvent<HTMLElement>) =>
    setModal({ type: "txDetail", origin: rectOf(e.currentTarget), entry });

  // ── Cuentas ────────────────────────────────────────────────────────────────
  const orderedAccounts = KIND_ORDER.flatMap((kind) => data.accounts.filter((a) => a.kind === kind));

  function accountActions(a: AccountCardView): RowAction[] {
    const meta = ACCOUNT_KIND_META[a.kind];
    return [
      {
        label: "Editar cuenta",
        icon: "mdi:pencil-outline",
        onClick: (e) => setModal({ type: "editAccount", origin: rectOf(e.currentTarget), account: a }),
      },
      {
        label: "Nueva transacción",
        icon: "mdi:plus",
        onClick: (e) =>
          setModal({
            type: "tx",
            origin: rectOf(e.currentTarget),
            preset: { accountId: a.id },
            context: [{ icon: meta.icon, label: "Cuenta", value: a.name }],
          }),
      },
    ];
  }

  function openAccountTxView(a: AccountCardView) {
    const rowId = `acct:${a.id}`;
    const origin = rowOrigin(rowId);
    if (!origin) return;
    const entries = data.entriesByAccount[a.id] ?? [];
    setTxView({
      origin,
      frame: measureFrame(),
      icon: ACCOUNT_KIND_META[a.kind].icon,
      accent: KIND_ACCENT[a.kind],
      title: a.name,
      total: formatMXN(a.balancePesos),
      totalNegative: a.balancePesos < 0,
      columnLabel: "Categoría",
      transactions: entries.map((e) => kitTxForAccount(e, a.id)),
      actions: accountActions(a),
      entriesById: new Map(entries.map((e) => [e.id, e])),
    });
  }

  // ── Presupuestos ──────────────────────────────────────────────────────────
  const plan = data.currentPlan;
  const cappedCategoryIds = plan ? plan.bars.map((b) => b.categoryId) : [];

  function budgetActions(bar: NonNullable<DashboardV2Data["currentPlan"]>["bars"][number]): RowAction[] {
    return [
      {
        label: "Editar presupuesto",
        icon: "mdi:pencil-outline",
        onClick: (e) =>
          setModal({
            type: "editBudget",
            origin: rectOf(e.currentTarget),
            editing: {
              budgetId: bar.budgetId,
              categoryId: bar.categoryId,
              categoryName: bar.categoryName,
              targetPesos: bar.targetPesos,
            },
          }),
      },
      {
        label: "Nueva transacción",
        icon: "mdi:plus",
        onClick: (e) =>
          setModal({
            type: "tx",
            origin: rectOf(e.currentTarget),
            preset: { categoryId: bar.categoryId, kind: "expense" },
            context: [{ icon: "mdi:tag-outline", label: "Categoría", value: bar.categoryName }],
          }),
      },
    ];
  }

  function openBudgetTxView(bar: NonNullable<DashboardV2Data["currentPlan"]>["bars"][number]) {
    const rowId = `budget:${bar.budgetId}`;
    const origin = rowOrigin(rowId);
    if (!origin) return;
    const entries = data.entriesByCategory[bar.categoryId] ?? [];
    setTxView({
      origin,
      frame: measureFrame(),
      title: bar.categoryName,
      columnLabel: "Cuenta",
      progress: {
        label: bar.categoryName,
        current: bar.realPesos,
        target: bar.targetPesos,
        currentLabel: formatMXN(bar.realPesos),
        targetLabel: formatMXN(bar.targetPesos),
      },
      transactions: entries.map((e) => kitTxForCategory(e, data.accounts)),
      actions: budgetActions(bar),
      entriesById: new Map(entries.map((e) => [e.id, e])),
    });
  }

  const sectionHeading: CSSProperties = {
    margin: 0,
    fontSize: "var(--text-heading)",
    fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
  };
  const divider = <div style={{ height: "var(--border-width)", background: "var(--border)" }} />;

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StatDisplay
        label="Saldo actual"
        value={formatMXN(data.currentBalancePesos)}
        negative={data.currentBalancePesos < 0}
      />

      {/* Día de pago pendiente: pide el monto real antes que nada. */}
      {data.pendingPaydays.map((p) => (
        <PaydayPrompt key={p.scheduleId} payday={p} />
      ))}

      <BalanceTimeline
        series={data.series}
        today={data.today}
        entriesByDay={data.entriesByDay}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        onAddAtDay={(date, origin) =>
          setModal({
            type: "tx",
            origin,
            preset: { date },
            context: [
              {
                icon: "mdi:calendar-outline",
                label: date > data.today ? "Proyección" : "Fecha",
                value: humanDateLabel(date),
              },
            ],
          })
        }
        onEntryClick={openDetail}
        onConfigureIncome={() => setShowScheduleForm(true)}
      />

      {divider}

      {/* ── Cuentas ── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={sectionHeading}>Cuentas</h2>
          <button
            type="button"
            aria-label="Nueva cuenta"
            title="Nueva cuenta"
            style={circleBtn(30)}
            onClick={(e) => setModal({ type: "account", origin: rectOf(e.currentTarget) })}
          >
            <Icon icon="mdi:plus" style={{ fontSize: 15 }} />
          </button>
        </div>
        {orderedAccounts.map((a) => {
          const rowId = `acct:${a.id}`;
          const entries = data.entriesByAccount[a.id] ?? [];
          return (
            <div
              key={a.id}
              ref={(el) => {
                rowRefs.current[rowId] = el;
              }}
            >
              <ExpandableRow
                icon={ACCOUNT_KIND_META[a.kind].icon}
                accent={KIND_ACCENT[a.kind]}
                title={a.name}
                subtitle={a.bank ?? undefined}
                amount={formatMXN(a.balancePesos)}
                negative={a.balancePesos < 0}
                expanded={openId === rowId}
                onToggle={() => toggleOpen(rowId)}
                transactions={entries.slice(0, 3).map((e) => kitTxForAccount(e, a.id))}
                onTransactionClick={(t, e) => {
                  const entry = entries.find((x) => x.id === t.id);
                  if (entry) openDetail(entry, e);
                }}
                viewAction={{
                  label: "Ver transacciones",
                  icon: "mdi:format-list-bulleted",
                  onClick: () => openAccountTxView(a),
                }}
                actions={accountActions(a)}
              />
            </div>
          );
        })}
      </section>

      {divider}

      {/* ── Presupuestos del plan vigente ── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={sectionHeading}>Presupuestos</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {plan && (
              <Link
                href={`/plans/${plan.id}`}
                style={{ fontSize: "var(--text-caption)", color: "var(--text-muted)", textDecoration: "none" }}
              >
                {plan.name} →
              </Link>
            )}
            {plan && (
              <button
                type="button"
                aria-label="Nuevo presupuesto"
                title="Nuevo presupuesto"
                style={circleBtn(30)}
                onClick={(e) => setModal({ type: "budget", origin: rectOf(e.currentTarget) })}
              >
                <Icon icon="mdi:plus" style={{ fontSize: 15 }} />
              </button>
            )}
          </div>
        </div>

        {!plan && (
          <div
            style={{
              border: "var(--border-width) dashed var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>
              Aún no tienes un plan para este periodo. Crea uno para ver aquí cuánto llevas gastado por
              categoría.
            </p>
            <Link
              href="/plans"
              style={{
                alignSelf: "center",
                fontSize: "var(--text-caption)",
                fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
                color: "var(--accent-strong)",
                textDecoration: "none",
              }}
            >
              Crear un plan →
            </Link>
          </div>
        )}

        {plan && plan.bars.length === 0 && (
          <div
            style={{
              border: "var(--border-width) dashed var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--text-muted)" }}>
              Tu plan “{plan.name}” no tiene topes por categoría todavía — usa el (+) para agregar el
              primero.
            </p>
          </div>
        )}

        {plan &&
          plan.bars.map((bar) => {
            const rowId = `budget:${bar.budgetId}`;
            const entries = (data.entriesByCategory[bar.categoryId] ?? []).filter(
              (e) => e.date >= plan.periodStart && e.date <= plan.periodEnd
            );
            return (
              <div
                key={bar.budgetId}
                ref={(el) => {
                  rowRefs.current[rowId] = el;
                }}
              >
                <ExpandableRow
                  variant="budget"
                  label={bar.categoryName}
                  current={bar.realPesos}
                  target={bar.targetPesos}
                  currentLabel={formatMXN(bar.realPesos)}
                  targetLabel={formatMXN(bar.targetPesos)}
                  expanded={openId === rowId}
                  onToggle={() => toggleOpen(rowId)}
                  transactions={entries.slice(0, 3).map((e) => kitTxForCategory(e, data.accounts))}
                  onTransactionClick={(t, e) => {
                    const entry = entries.find((x) => x.id === t.id);
                    if (entry) openDetail(entry, e);
                  }}
                  viewAction={{
                    label: "Ver transacciones",
                    icon: "mdi:format-list-bulleted",
                    onClick: () => openBudgetTxView(bar),
                  }}
                  actions={budgetActions(bar)}
                />
              </div>
            );
          })}
      </section>

      {/* ── Modales ── */}
      {modal?.type === "account" && <NewAccountModal origin={modal.origin} onClose={closeModal} />}
      {modal?.type === "editAccount" && (
        <NewAccountModal origin={modal.origin} onClose={closeModal} account={modal.account} />
      )}
      {modal?.type === "budget" && plan && (
        <NewBudgetModal
          origin={modal.origin}
          onClose={closeModal}
          planId={plan.id}
          expenseCategories={data.expenseCategories}
          cappedCategoryIds={cappedCategoryIds}
        />
      )}
      {modal?.type === "editBudget" && plan && (
        <NewBudgetModal
          origin={modal.origin}
          onClose={closeModal}
          planId={plan.id}
          expenseCategories={data.expenseCategories}
          cappedCategoryIds={cappedCategoryIds}
          editing={modal.editing}
        />
      )}
      {modal?.type === "tx" && (
        <NewTransactionModal
          origin={modal.origin}
          onClose={closeModal}
          accounts={data.accounts}
          incomeCategories={data.incomeCategories}
          expenseCategories={data.expenseCategories}
          today={data.today}
          preset={modal.preset}
          context={modal.context}
        />
      )}
      {modal?.type === "txDetail" && (
        <TransactionDetailModal
          origin={modal.origin}
          onClose={closeModal}
          entry={modal.entry}
          accounts={data.accounts}
          incomeCategories={data.incomeCategories}
          expenseCategories={data.expenseCategories}
        />
      )}

      {/* ── Vista completa de transacciones (morph) ── */}
      {txView && (
        <TransactionsView
          origin={txView.origin}
          frame={txView.frame}
          icon={txView.icon}
          accent={txView.accent}
          title={txView.title}
          total={txView.total}
          totalNegative={txView.totalNegative}
          columnLabel={txView.columnLabel}
          progress={txView.progress}
          transactions={txView.transactions}
          actions={txView.actions}
          onTransactionClick={(t, e) => {
            const entry = txView.entriesById.get(t.id);
            if (entry) setModal({ type: "txDetail", origin: rectOf(e.currentTarget), entry });
          }}
          onClose={() => setTxView(null)}
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
