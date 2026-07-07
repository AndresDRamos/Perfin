"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { createAccountAction } from "@/app/actions/accounts";
import { ACCOUNT_KIND_META, accountKindTextClass, type AccountKind } from "@/lib/branding/account-kind";

type BankKind = Extract<AccountKind, "debit" | "credit" | "investment">;
const BANK_KINDS: BankKind[] = ["debit", "credit", "investment"];

interface CreatedAccount {
  id: number;
  name: string;
  kind: AccountKind;
  openingBalancePesos: number;
}

interface FieldErrors {
  [key: string]: string[] | undefined;
}

// ─── shared bits ────────────────────────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2 rounded-full transition-all ${
            n === step ? "w-6 bg-primary-600" : "w-2 bg-secondary-200 dark:bg-secondary-700"
          }`}
        />
      ))}
    </div>
  );
}

function KindCard({
  kind,
  selected,
  onSelect,
}: {
  kind: AccountKind;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = ACCOUNT_KIND_META[kind];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 text-sm transition-colors ${
        selected
          ? "border-primary-600 " + meta.bgSoft
          : "border-secondary-200 dark:border-secondary-700"
      }`}
    >
      <Icon icon={meta.icon} className={`h-7 w-7 ${accountKindTextClass(kind)}`} />
      <span className="font-medium">{meta.label}</span>
    </button>
  );
}

function AccountSummaryRow({ acc }: { acc: CreatedAccount }) {
  const meta = ACCOUNT_KIND_META[acc.kind];
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bgSoft}`}>
        <Icon icon={meta.icon} className={`h-5 w-5 ${accountKindTextClass(acc.kind)}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{acc.name}</p>
        <p className="text-xs text-gray-400">{meta.label}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold">
        {acc.openingBalancePesos.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
      </p>
    </div>
  );
}

// ─── step 1: cash ───────────────────────────────────────────────────────────────

function CashStep({ onNext }: { onNext: (created: CreatedAccount | null) => void }) {
  const [wantsCash, setWantsCash] = useState<boolean | null>(null);
  const [name, setName] = useState("Efectivo");
  const [amount, setAmount] = useState("0");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleContinue() {
    if (wantsCash !== true) {
      onNext(null);
      return;
    }
    setPending(true);
    const result = await createAccountAction({
      kind: "cash",
      name,
      openingBalancePesos: Number(amount || 0),
    });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      return;
    }
    onNext({ id: result.id, name, kind: "cash", openingBalancePesos: Number(amount || 0) });
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <Icon icon="mdi:cash" className="mx-auto h-10 w-10 text-primary-700 dark:text-primary-400" />
        <h2 className="mt-2 text-lg font-semibold">¿Tienes efectivo que quieras registrar?</h2>
        <p className="mt-1 text-sm text-gray-400">
          Efectivo es dinero físico que ya tienes — no está ligado a ningún banco.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setWantsCash(true)}
          className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium ${
            wantsCash === true
              ? "border-primary-600 bg-primary-100 dark:bg-primary-900"
              : "border-secondary-200 dark:border-secondary-700"
          }`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => setWantsCash(false)}
          className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium ${
            wantsCash === false
              ? "border-primary-600 bg-primary-100 dark:bg-primary-900"
              : "border-secondary-200 dark:border-secondary-700"
          }`}
        >
          No
        </button>
      </div>

      {wantsCash === true && (
        <div className="space-y-3">
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {errors.name && <p className="mt-0.5 text-xs text-red-600">{errors.name[0]}</p>}
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Monto actual (MXN)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              inputMode="decimal"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {errors.openingBalancePesos && (
              <p className="mt-0.5 text-xs text-red-600">{errors.openingBalancePesos[0]}</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={wantsCash === null || pending}
        onClick={handleContinue}
        className="w-full rounded bg-primary-600 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Continuar"}
      </button>
    </div>
  );
}

// ─── step 2: bank accounts ──────────────────────────────────────────────────────

function BankAccountForm({
  kind,
  onAdded,
  onCancel,
}: {
  kind: BankKind;
  onAdded: (created: CreatedAccount) => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const entered = Number(fd.get("openingBalancePesos") || 0);
    // Crédito: el input captura la DEUDA en positivo (así piensa el usuario),
    // pero el ledger guarda saldo firmado — deuda = negativo (convención de
    // balances derivados). Sin esta inversión el neto SUMA la deuda (bug real
    // detectado con datos de producción; migración 0009 reparó los afectados).
    const openingBalancePesos = kind === "credit" ? -entered : entered;
    const raw: Record<string, unknown> = {
      kind,
      name,
      openingBalancePesos,
      bank: fd.get("bank") || undefined,
      number: fd.get("number") || undefined,
      expirationMonth: fd.get("expirationMonth") || undefined,
    };
    if (kind === "credit") {
      raw.cutoffDay = Number(fd.get("cutoffDay"));
      raw.paymentDay = Number(fd.get("paymentDay"));
      const limit = fd.get("creditLimitPesos");
      if (limit) raw.creditLimitPesos = Number(limit);
    }
    setPending(true);
    const result = await createAccountAction(raw);
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      return;
    }
    onAdded({ id: result.id, name, kind, openingBalancePesos });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Icon icon={ACCOUNT_KIND_META[kind].icon} className={`h-5 w-5 ${accountKindTextClass(kind)}`} />
        <h3 className="text-sm font-medium">{ACCOUNT_KIND_META[kind].label}</h3>
      </div>
      <div>
        <label className="mb-0.5 block text-xs text-gray-500">Nombre</label>
        <input name="name" required maxLength={100} className="w-full rounded border px-3 py-2 text-sm" />
        {errors.name && <p className="mt-0.5 text-xs text-red-600">{errors.name[0]}</p>}
      </div>
      <div>
        <label className="mb-0.5 block text-xs text-gray-500">Banco / institución</label>
        <input name="bank" maxLength={100} className="w-full rounded border px-3 py-2 text-sm" />
        {errors.bank && <p className="mt-0.5 text-xs text-red-600">{errors.bank[0]}</p>}
      </div>
      <div>
        <label className="mb-0.5 block text-xs text-gray-500">
          {kind === "credit" ? "Deuda actual (MXN, si aplica)" : "Saldo inicial (MXN)"}
        </label>
        <input
          name="openingBalancePesos"
          type="number"
          step="0.01"
          inputMode="decimal"
          defaultValue={0}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      {kind === "credit" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Día de corte</label>
            <input
              name="cutoffDay"
              type="number"
              min={1}
              max={28}
              required
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {errors.cutoffDay && <p className="mt-0.5 text-xs text-red-600">{errors.cutoffDay[0]}</p>}
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Día de pago</label>
            <input
              name="paymentDay"
              type="number"
              min={1}
              max={28}
              required
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {errors.paymentDay && <p className="mt-0.5 text-xs text-red-600">{errors.paymentDay[0]}</p>}
          </div>
        </div>
      )}
      {errors._form && <p className="text-sm text-red-600">{errors._form[0]}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Agregar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-4 py-2.5 text-sm text-secondary-600 dark:text-secondary-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function BankStep({
  added,
  onAdded,
  onNext,
}: {
  added: CreatedAccount[];
  onAdded: (created: CreatedAccount) => void;
  onNext: () => void;
}) {
  const [picking, setPicking] = useState<BankKind | null>(null);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Cuentas bancarias</h2>
        <p className="mt-1 text-sm text-gray-400">
          Débito, crédito o inversión — agrega las que quieras, una a la vez.
        </p>
      </div>

      {added.length > 0 && (
        <div className="space-y-2">
          {added.map((a) => (
            <AccountSummaryRow key={a.id} acc={a} />
          ))}
        </div>
      )}

      {picking ? (
        <BankAccountForm
          kind={picking}
          onAdded={(created) => {
            onAdded(created);
            setPicking(null);
          }}
          onCancel={() => setPicking(null)}
        />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {BANK_KINDS.map((kind) => (
            <KindCard key={kind} kind={kind} selected={false} onSelect={() => setPicking(kind)} />
          ))}
        </div>
      )}

      {!picking && (
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded bg-primary-600 py-3 text-sm font-medium text-white"
        >
          Continuar
        </button>
      )}
    </div>
  );
}

// ─── step 3: summary ────────────────────────────────────────────────────────────

function SummaryStep({ accounts }: { accounts: CreatedAccount[] }) {
  const router = useRouter();
  return (
    <div className="space-y-5">
      <div className="text-center">
        <Icon icon="mdi:check-circle" className="mx-auto h-10 w-10 text-primary-600" />
        <h2 className="mt-2 text-lg font-semibold">¡Listo!</h2>
        <p className="mt-1 text-sm text-gray-400">
          {accounts.length > 0
            ? "Estas son tus cuentas registradas."
            : "No registraste cuentas todavía — puedes agregarlas después desde Cuentas."}
        </p>
      </div>

      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((a) => (
            <AccountSummaryRow key={a.id} acc={a} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/")}
        className="w-full rounded bg-primary-600 py-3 text-sm font-medium text-white"
      >
        Terminar
      </button>
    </div>
  );
}

// ─── wizard shell ───────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accounts, setAccounts] = useState<CreatedAccount[]>([]);

  return (
    <div className="space-y-6">
      <StepDots step={step} />
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
        />
      )}
      {step === 3 && <SummaryStep accounts={accounts} />}
    </div>
  );
}
