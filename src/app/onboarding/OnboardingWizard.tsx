"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { createAccountAction } from "@/app/actions/accounts";
import { createIncomeScheduleAction } from "@/app/actions/income-schedule";
import { createFixedExpenseAction } from "@/app/actions/fixed-expenses";
import { ACCOUNT_KIND_META, type AccountKind } from "@/lib/branding/account-kind";
import { StepDots } from "@/app/components/ui/StepDots";
import { KindCard } from "@/app/components/ui/KindCard";
import { KitButton } from "@/app/components/ui/Button";
import { Chip } from "@/app/components/ui/Chip";
import { IconBadge } from "@/app/components/ui/IconBadge";
import { KIND_ACCENT, formatMontoInput, modalField, modalLabel, montoInputToPesos } from "@/app/components/ui/kit";
import { formatMXN } from "@/app/components/dashboard/ui";

type BankKind = Extract<AccountKind, "debit" | "credit" | "investment">;
const BANK_KINDS: BankKind[] = ["debit", "credit", "investment"];

interface Category {
  id: number;
  name: string;
}

interface CreatedAccount {
  id: number;
  name: string;
  kind: AccountKind;
  bank?: string;
  openingBalancePesos: number;
}

interface FieldErrors {
  [key: string]: string[] | undefined;
}

const FREQS: { id: "weekly" | "biweekly" | "semimonthly" | "monthly"; label: string }[] = [
  { id: "weekly", label: "Semanal" },
  { id: "biweekly", label: "Catorcenal" },
  { id: "semimonthly", label: "Quincenal" },
  { id: "monthly", label: "Mensual" },
];

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-heading)",
  fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
};
const captionMuted: CSSProperties = { margin: 0, fontSize: "var(--text-caption)", color: "var(--text-muted)" };
const cardBox: CSSProperties = {
  border: "var(--border-width) solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const errText: CSSProperties = { margin: "4px 0 0", fontSize: "var(--text-caption)", color: "var(--negative)" };

function firstError(errors: FieldErrors): string | null {
  const vals = Object.values(errors).flat().filter(Boolean) as string[];
  return vals[0] ?? null;
}

function AccountSummaryRow({ acc }: { acc: CreatedAccount }) {
  const meta = ACCOUNT_KIND_META[acc.kind];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: "var(--border-width) solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
      }}
    >
      <IconBadge icon={meta.icon} accent={KIND_ACCENT[acc.kind]} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-body)",
            fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {acc.name}
        </p>
        <p style={captionMuted}>{acc.bank || meta.label}</p>
      </div>
      <p
        style={{
          margin: 0,
          flexShrink: 0,
          fontSize: "var(--text-body)",
          fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
          fontVariantNumeric: "tabular-nums",
          color: acc.openingBalancePesos < 0 ? "var(--negative)" : "var(--text)",
        }}
      >
        {formatMXN(acc.openingBalancePesos)}
      </p>
    </div>
  );
}

// ─── paso 1: efectivo ────────────────────────────────────────────────────────

function CashStep({ onNext }: { onNext: (created: CreatedAccount | null) => void }) {
  const [wantsCash, setWantsCash] = useState<boolean | null>(null);
  const [name, setName] = useState("Efectivo");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleContinue() {
    if (wantsCash !== true) {
      onNext(null);
      return;
    }
    setPending(true);
    const pesos = montoInputToPesos(amount);
    const result = await createAccountAction({ kind: "cash", name, openingBalancePesos: pesos });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      return;
    }
    onNext({ id: result.id, name, kind: "cash", openingBalancePesos: pesos });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
      <Icon icon="mdi:cash" style={{ fontSize: 40, color: "var(--accent-strong)", margin: "0 auto" }} />
      <h2 style={headingStyle}>¿Tienes efectivo que quieras registrar?</h2>
      <p style={captionMuted}>Efectivo es dinero físico que ya tienes — no está ligado a ningún banco.</p>
      <div style={{ display: "flex", gap: 10 }}>
        <KitButton variant={wantsCash === true ? "primary" : "secondary"} onClick={() => setWantsCash(true)}>
          Sí
        </KitButton>
        <KitButton variant={wantsCash === false ? "primary" : "secondary"} onClick={() => setWantsCash(false)}>
          No
        </KitButton>
      </div>
      {wantsCash === true && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
          <div>
            <label style={modalLabel}>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} style={modalField} />
            {errors.name && <p style={errText}>{errors.name[0]}</p>}
          </div>
          <div>
            <label style={modalLabel}>Monto actual (MXN)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(formatMontoInput(e.target.value))}
              inputMode="numeric"
              placeholder="0.00"
              style={modalField}
            />
            {errors.openingBalancePesos && <p style={errText}>{errors.openingBalancePesos[0]}</p>}
          </div>
        </div>
      )}
      <KitButton disabled={wantsCash === null || pending} onClick={handleContinue}>
        {pending ? "Guardando…" : "Continuar"}
      </KitButton>
    </div>
  );
}

// ─── paso 2: cuentas bancarias ───────────────────────────────────────────────

function BankAccountForm({
  kind,
  onAdded,
  onCancel,
}: {
  kind: BankKind;
  onAdded: (created: CreatedAccount) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const meta = ACCOUNT_KIND_META[kind];

  async function submit() {
    const entered = montoInputToPesos(amount);
    // Crédito: el input captura la DEUDA en positivo (así piensa el usuario),
    // pero el ledger guarda saldo firmado — deuda = negativo.
    const openingBalancePesos = kind === "credit" ? -entered : entered;
    const raw: Record<string, unknown> = {
      kind,
      name,
      openingBalancePesos,
      bank: bank.trim() || undefined,
    };
    if (kind === "credit") {
      raw.cutoffDay = Number(cutoffDay);
      raw.paymentDay = Number(paymentDay);
    }
    setPending(true);
    const result = await createAccountAction(raw);
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      return;
    }
    onAdded({ id: result.id, name, kind, bank: bank.trim() || undefined, openingBalancePesos });
  }

  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconBadge icon={meta.icon} accent={KIND_ACCENT[kind]} size={28} iconSize={15} />
        <h3 style={{ margin: 0, fontSize: "var(--text-body)", fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"] }}>
          {meta.label}
        </h3>
      </div>
      <div>
        <label style={modalLabel}>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={meta.label} style={modalField} />
        {errors.name && <p style={errText}>{errors.name[0]}</p>}
      </div>
      <div>
        <label style={modalLabel}>Banco / institución</label>
        <input value={bank} onChange={(e) => setBank(e.target.value)} maxLength={100} placeholder="BBVA" style={modalField} />
        {errors.bank && <p style={errText}>{errors.bank[0]}</p>}
      </div>
      <div>
        <label style={modalLabel}>{kind === "credit" ? "Deuda actual (MXN, si aplica)" : "Saldo inicial (MXN)"}</label>
        <input
          value={amount}
          onChange={(e) => setAmount(formatMontoInput(e.target.value))}
          inputMode="numeric"
          placeholder="0.00"
          style={modalField}
        />
      </div>
      {kind === "credit" && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={modalLabel}>Día de corte (1–28)</label>
            <input
              value={cutoffDay}
              onChange={(e) => setCutoffDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="15"
              style={{ ...modalField, textAlign: "center" }}
            />
            {errors.cutoffDay && <p style={errText}>{errors.cutoffDay[0]}</p>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={modalLabel}>Día de pago (1–28)</label>
            <input
              value={paymentDay}
              onChange={(e) => setPaymentDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="5"
              style={{ ...modalField, textAlign: "center" }}
            />
            {errors.paymentDay && <p style={errText}>{errors.paymentDay[0]}</p>}
          </div>
        </div>
      )}
      {firstError(errors) && !errors.name && !errors.bank && !errors.cutoffDay && !errors.paymentDay && (
        <p style={errText}>{firstError(errors)}</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <KitButton onClick={submit} disabled={pending || !name.trim()}>
          {pending ? "Guardando…" : "Agregar"}
        </KitButton>
        <KitButton variant="secondary" onClick={onCancel}>
          Cancelar
        </KitButton>
      </div>
    </div>
  );
}

function BankStep({
  added,
  onAdded,
  onNext,
  onBack,
}: {
  added: CreatedAccount[];
  onAdded: (created: CreatedAccount) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [picking, setPicking] = useState<BankKind | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={headingStyle}>Cuentas bancarias</h2>
        <p style={{ ...captionMuted, marginTop: 4 }}>Débito, crédito o inversión — agrega las que quieras.</p>
      </div>

      {added.map((a) => (
        <AccountSummaryRow key={a.id} acc={a} />
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {BANK_KINDS.map((kind) => (
          <KindCard
            key={kind}
            icon={ACCOUNT_KIND_META[kind].icon}
            label={ACCOUNT_KIND_META[kind].label}
            accent={KIND_ACCENT[kind]}
            selected={picking === kind}
            onClick={() => setPicking(kind)}
          />
        ))}
      </div>

      {picking && (
        <BankAccountForm
          kind={picking}
          onAdded={(created) => {
            onAdded(created);
            setPicking(null);
          }}
          onCancel={() => setPicking(null)}
        />
      )}

      {!picking && (
        <>
          <KitButton onClick={onNext}>Continuar</KitButton>
          <KitButton variant="ghost" onClick={onBack}>
            Atrás
          </KitButton>
        </>
      )}
    </div>
  );
}

// ─── paso 3: salario / nómina ────────────────────────────────────────────────

function SalaryStep({
  accounts,
  incomeCategories,
  onNext,
  onBack,
}: {
  accounts: CreatedAccount[];
  incomeCategories: Category[];
  onNext: (registered: boolean) => void;
  onBack: () => void;
}) {
  const [hasPayroll, setHasPayroll] = useState<boolean | null>(null);
  const [freq, setFreq] = useState<(typeof FREQS)[number]["id"] | null>(null);
  const [amount, setAmount] = useState("");
  const [acctId, setAcctId] = useState<number | null>(null);
  const [nextDate, setNextDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    hasPayroll === false ||
    (hasPayroll === true && freq !== null && acctId !== null && montoInputToPesos(amount) > 0 && !!nextDate);

  async function continueStep() {
    if (hasPayroll !== true) {
      onNext(false);
      return;
    }
    setPending(true);
    setError(null);
    // Si existe una categoría tipo nómina/salario/ingreso, se asigna.
    const nominaCat = incomeCategories.find((c) => /n[oó]mina|salario|sueldo/i.test(c.name));
    const res = await createIncomeScheduleAction({
      name: "Nómina",
      frequency: freq,
      estimatedAmountPesos: montoInputToPesos(amount),
      accountId: acctId,
      incomeCategoryId: nominaCat?.id,
      anchorDate: nextDate,
    });
    setPending(false);
    if (!res.ok) {
      setError(firstError(res.errors ?? {}) ?? "No se pudo guardar la nómina");
      return;
    }
    onNext(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <Icon icon="mdi:briefcase-outline" style={{ fontSize: 40, color: "var(--accent-strong)" }} />
        <h2 style={{ ...headingStyle, marginTop: 8 }}>Salario</h2>
        <p style={{ ...captionMuted, marginTop: 4 }}>¿Ya cuentas con una nómina? Podemos programar tus pagos.</p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <KitButton variant={hasPayroll === true ? "primary" : "secondary"} onClick={() => setHasPayroll(true)}>
          Sí, tengo nómina
        </KitButton>
        <KitButton variant={hasPayroll === false ? "primary" : "secondary"} onClick={() => setHasPayroll(false)}>
          Aún no
        </KitButton>
      </div>

      {hasPayroll === true && (
        <div style={cardBox}>
          <div>
            <label style={modalLabel}>Frecuencia de pago</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FREQS.map((f) => (
                <Chip key={f.id} active={freq === f.id} onClick={() => setFreq(f.id)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <label style={modalLabel}>Monto estimado por pago (MXN)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(formatMontoInput(e.target.value))}
              inputMode="numeric"
              placeholder="0.00"
              style={modalField}
            />
          </div>
          <div>
            <label style={modalLabel}>Fecha de tu próximo pago</label>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} style={modalField} />
          </div>
          <div>
            <label style={modalLabel}>Cuenta donde se deposita</label>
            {accounts.length === 0 ? (
              <p style={captionMuted}>No agregaste cuentas. Puedes configurar tu nómina más tarde.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {accounts.map((a) => (
                  <Chip key={a.id} active={acctId === a.id} onClick={() => setAcctId(a.id)}>
                    {a.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          {error && <p style={errText}>{error}</p>}
        </div>
      )}

      <KitButton disabled={!ready || pending} onClick={continueStep}>
        {pending ? "Guardando…" : "Continuar"}
      </KitButton>
      <KitButton variant="ghost" onClick={onBack}>
        Atrás
      </KitButton>
    </div>
  );
}

// ─── paso 4: gastos fijos ────────────────────────────────────────────────────

interface FixedDraft {
  name: string;
  day: string;
  amount: string;
  kind: "servicio" | "suscripcion";
  accountId: number | null;
}

function FixedStep({
  accounts,
  expenseCategories,
  registered,
  onRegistered,
  onNext,
  onBack,
}: {
  accounts: CreatedAccount[];
  expenseCategories: Category[];
  registered: FixedDraft[];
  onRegistered: (d: FixedDraft) => void;
  onNext: (hasAny: boolean) => void;
  onBack: () => void;
}) {
  const [hasFixed, setHasFixed] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<FixedDraft>({ name: "", day: "", amount: "", kind: "servicio", accountId: accounts[0]?.id ?? null });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const servicioCat = expenseCategories.find((c) => /servicio/i.test(c.name));
  const suscripcionCat = expenseCategories.find((c) => /su[bs]scri|suscri/i.test(c.name));
  const catFor = (kind: FixedDraft["kind"]) =>
    (kind === "suscripcion" ? suscripcionCat : servicioCat) ?? servicioCat ?? suscripcionCat ?? expenseCategories[0];

  const draftReady =
    draft.name.trim() !== "" &&
    montoInputToPesos(draft.amount) > 0 &&
    Number(draft.day) >= 1 &&
    Number(draft.day) <= 31 &&
    draft.accountId !== null &&
    !!catFor(draft.kind);

  async function addExpense() {
    if (!draftReady || pending) return;
    setPending(true);
    setError(null);
    const res = await createFixedExpenseAction({
      name: draft.name.trim(),
      amountPesos: montoInputToPesos(draft.amount),
      accountId: draft.accountId,
      expenseCategoryId: catFor(draft.kind)!.id,
      dayOfMonth: Number(draft.day),
    });
    setPending(false);
    if (!res.ok) {
      setError(firstError(res.errors ?? {}) ?? "No se pudo guardar el gasto fijo");
      return;
    }
    onRegistered(draft);
    setDraft({ name: "", day: "", amount: "", kind: "servicio", accountId: draft.accountId });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <Icon icon="mdi:calendar-month-outline" style={{ fontSize: 40, color: "var(--accent-strong)" }} />
        <h2 style={{ ...headingStyle, marginTop: 8 }}>Gastos fijos</h2>
        <p style={{ ...captionMuted, marginTop: 4 }}>
          ¿Tienes gastos recurrentes cada mes? Renta, servicios, suscripciones…
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <KitButton variant={hasFixed === true ? "primary" : "secondary"} onClick={() => setHasFixed(true)}>
          Sí
        </KitButton>
        <KitButton variant={hasFixed === false ? "primary" : "secondary"} onClick={() => setHasFixed(false)}>
          No
        </KitButton>
      </div>

      {hasFixed === true && registered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {registered.map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "var(--border-width) solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
              }}
            >
              <IconBadge
                icon={e.kind === "suscripcion" ? "mdi:repeat-variant" : "mdi:receipt-text-outline"}
                accent={e.kind === "suscripcion" ? "purple" : "indigo"}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "var(--text-body)", fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"] }}>
                  {e.name}
                </p>
                <p style={captionMuted}>
                  Día {e.day} · {e.kind === "suscripcion" ? "Suscripción" : "Servicio"}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: "var(--text-body)", fontVariantNumeric: "tabular-nums", color: "var(--negative)" }}>
                −${e.amount}
              </p>
            </div>
          ))}
        </div>
      )}

      {hasFixed === true &&
        (accounts.length === 0 ? (
          <p style={{ ...captionMuted, textAlign: "center" }}>
            Necesitas al menos una cuenta para programar gastos fijos — puedes hacerlo más tarde desde Planes.
          </p>
        ) : (
          <div style={cardBox}>
            <div>
              <label style={modalLabel}>Nombre</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                maxLength={100}
                placeholder="Renta, Netflix…"
                style={modalField}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={modalLabel}>Día de pago</label>
                <input
                  value={draft.day}
                  onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                  inputMode="numeric"
                  placeholder="15"
                  style={{ ...modalField, textAlign: "center" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={modalLabel}>Monto (MXN)</label>
                <input
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: formatMontoInput(e.target.value) }))}
                  inputMode="numeric"
                  placeholder="0.00"
                  style={modalField}
                />
              </div>
            </div>
            <div>
              <label style={modalLabel}>Tipo</label>
              <div style={{ display: "flex", gap: 8 }}>
                <Chip active={draft.kind === "servicio"} onClick={() => setDraft((d) => ({ ...d, kind: "servicio" }))}>
                  Servicio
                </Chip>
                <Chip active={draft.kind === "suscripcion"} onClick={() => setDraft((d) => ({ ...d, kind: "suscripcion" }))}>
                  Suscripción
                </Chip>
              </div>
            </div>
            <div>
              <label style={modalLabel}>Cuenta que lo paga</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {accounts.map((a) => (
                  <Chip key={a.id} active={draft.accountId === a.id} onClick={() => setDraft((d) => ({ ...d, accountId: a.id }))}>
                    {a.name}
                  </Chip>
                ))}
              </div>
            </div>
            {error && <p style={errText}>{error}</p>}
            <KitButton variant="secondary" disabled={!draftReady || pending} onClick={addExpense}>
              {pending ? "Guardando…" : "+ Agregar gasto"}
            </KitButton>
          </div>
        ))}

      <KitButton disabled={hasFixed === null} onClick={() => onNext(registered.length > 0)}>
        Continuar
      </KitButton>
      <KitButton variant="ghost" onClick={onBack}>
        Atrás
      </KitButton>
    </div>
  );
}

// ─── paso 5: resumen ─────────────────────────────────────────────────────────

function SummaryStep({
  accounts,
  hasPayroll,
  fixedCount,
}: {
  accounts: CreatedAccount[];
  hasPayroll: boolean;
  fixedCount: number;
}) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
      <Icon icon="mdi:check-circle" style={{ fontSize: 40, color: "var(--accent-strong)", margin: "0 auto" }} />
      <h2 style={headingStyle}>¡Listo!</h2>
      <p style={captionMuted}>
        {accounts.length > 0
          ? `Configuraste ${accounts.length} cuenta${accounts.length === 1 ? "" : "s"}${hasPayroll ? ", tu nómina" : ""}${
              fixedCount > 0 ? ` y ${fixedCount} gasto${fixedCount === 1 ? "" : "s"} fijo${fixedCount === 1 ? "" : "s"}` : ""
            }.`
          : "No registraste cuentas todavía — puedes agregarlas después desde el dashboard."}
      </p>
      {accounts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          {accounts.map((a) => (
            <AccountSummaryRow key={a.id} acc={a} />
          ))}
        </div>
      )}
      <KitButton onClick={() => router.push("/")}>Terminar</KitButton>
    </div>
  );
}

// ─── shell del wizard ────────────────────────────────────────────────────────
// Flujo del kit: efectivo → cuentas bancarias → salario → gastos fijos → listo.

export function OnboardingWizard({
  expenseCategories,
  incomeCategories,
}: {
  expenseCategories: Category[];
  incomeCategories: Category[];
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [accounts, setAccounts] = useState<CreatedAccount[]>([]);
  const [hasPayroll, setHasPayroll] = useState(false);
  const [fixed, setFixed] = useState<FixedDraft[]>([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StepDots step={step} total={5} />
      {step === 1 && (
        <CashStep
          onNext={(created) => {
            if (created) setAccounts((prev) => [...prev, created]);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <BankStep
          added={accounts.filter((a) => a.kind !== "cash")}
          onAdded={(created) => setAccounts((prev) => [...prev, created])}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <SalaryStep
          accounts={accounts}
          incomeCategories={incomeCategories}
          onNext={(registered) => {
            setHasPayroll(registered);
            setStep(4);
          }}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <FixedStep
          accounts={accounts}
          expenseCategories={expenseCategories}
          registered={fixed}
          onRegistered={(d) => setFixed((prev) => [...prev, d])}
          onNext={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && <SummaryStep accounts={accounts} hasPayroll={hasPayroll} fixedCount={fixed.length} />}
    </div>
  );
}
