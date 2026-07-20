"use client";

import { useState, useTransition, useActionState } from "react";
import { Icon } from "@iconify/react";
import {
  createAccountAction,
  updateAccountAction,
  deactivateAccountAction,
  reactivateAccountAction,
  type AccountView,
} from "@/app/actions/accounts";
import type { Account } from "@/data/schema";
import { ACCOUNT_KIND_META, accountKindTextClass } from "@/lib/branding/account-kind";

type Kind = Account["kind"];

const KIND_LABELS: Record<Kind, string> = {
  cash: "Efectivo",
  debit: "Débito",
  credit: "Crédito",
  investment: "Inversión",
};

// cash is a physical account, never a bank product (ADR-009,
// chk_cash_no_bank_fields) — it never shows bank/number/expiration fields.
const CARD_KINDS: Kind[] = ["debit", "credit"];
const BANK_KINDS: Kind[] = ["debit", "credit", "investment"];

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
  // On validation error the raw field values are preserved here and the form is
  // remounted (key=attempt) so React 19's automatic form reset doesn't wipe the
  // user's input nor desync the DOM from component state.
  values?: Record<string, string>;
  attempt?: number;
}

function preserveValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) out[k] = String(v);
  return out;
}

function formatMXN(pesos: number) {
  return pesos.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// "YYYY-MM-DD" (day 1) → "MM/YY" for display; "YYYY-MM" for the month input.
function expirationLabel(date: string | null) {
  if (!date) return null;
  const [y, m] = date.split("-");
  return `${m}/${y.slice(2)}`;
}
function expirationMonthValue(date: string | null) {
  return date ? date.slice(0, 7) : "";
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-negative text-xs mt-0.5">{errors[0]}</p>;
}

// ─── shared conditional fields (bank / number / expiration / credit config) ─────

function MetadataFields({
  kind,
  defaults,
  errors,
  values,
}: {
  kind: Kind;
  defaults?: Account;
  errors?: FormState["errors"];
  values?: Record<string, string>;
}) {
  const dv = (field: string, fromAccount: string) => values?.[field] ?? fromAccount;
  return (
    <>
      {BANK_KINDS.includes(kind) && (
        <div>
          <label className="block text-xs text-text-muted mb-0.5">Banco / institución</label>
          <input
            name="bank"
            type="text"
            maxLength={100}
            defaultValue={dv("bank", defaults?.bank ?? "")}
            className="w-full rounded border px-3 py-1.5 text-sm"
          />
          <FieldError errors={errors?.bank} />
        </div>
      )}
      {BANK_KINDS.includes(kind) && (
        <div>
          <label className="block text-xs text-text-muted mb-0.5">
            Número (enmascarado, p.ej. ****1234)
          </label>
          <input
            name="number"
            type="text"
            maxLength={30}
            defaultValue={dv("number", defaults?.number ?? "")}
            className="w-full rounded border px-3 py-1.5 text-sm"
          />
          <FieldError errors={errors?.number} />
        </div>
      )}
      {CARD_KINDS.includes(kind) && (
        <div>
          <label className="block text-xs text-text-muted mb-0.5">Vigencia (MM/AA)</label>
          <input
            name="expirationMonth"
            type="month"
            defaultValue={dv("expirationMonth", expirationMonthValue(defaults?.expirationDate ?? null))}
            className="w-full rounded border px-3 py-1.5 text-sm"
          />
          <FieldError errors={errors?.expirationMonth} />
        </div>
      )}
      {kind === "credit" && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-text-muted mb-0.5">Día de corte</label>
            <input
              name="cutoffDay"
              type="number"
              min={1}
              max={28}
              required
              defaultValue={dv("cutoffDay", String(defaults?.cutoffDay ?? ""))}
              className="w-full rounded border px-3 py-1.5 text-sm"
            />
            <FieldError errors={errors?.cutoffDay} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-0.5">Día de pago</label>
            <input
              name="paymentDay"
              type="number"
              min={1}
              max={28}
              required
              defaultValue={dv("paymentDay", String(defaults?.paymentDay ?? ""))}
              className="w-full rounded border px-3 py-1.5 text-sm"
            />
            <FieldError errors={errors?.paymentDay} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-0.5">Límite (MXN)</label>
            <input
              name="creditLimitPesos"
              type="number"
              min={0}
              step="0.01"
              defaultValue={dv("creditLimitPesos", defaults?.creditLimit != null ? String(defaults.creditLimit / 100) : "")}
              className="w-full rounded border px-3 py-1.5 text-sm"
            />
            <FieldError errors={errors?.creditLimitPesos} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── create form ────────────────────────────────────────────────────────────────

function NewAccountForm() {
  const [kind, setKind] = useState<Kind>("cash");

  const [state, action, pending] = useActionState(
    async (_prev: FormState, fd: FormData): Promise<FormState> => {
      const entered = Number(fd.get("openingBalancePesos") || 0);
      const raw: Record<string, unknown> = {
        kind,
        name: fd.get("name"),
        // Crédito: el input captura la DEUDA en positivo; el ledger guarda
        // saldo firmado (deuda = negativo) — mismo contrato que el onboarding.
        openingBalancePesos: kind === "credit" ? -entered : entered,
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
      const result = await createAccountAction(raw);
      const attempt = (_prev.attempt ?? 0) + 1;
      // On error, remount the form (key=attempt) with the typed values preserved.
      return result.ok ? { ...result, attempt } : { ...result, attempt, values: preserveValues(fd) };
    },
    {} as FormState
  );

  return (
    <form key={state.attempt ?? 0} action={action} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium text-sm">Nueva cuenta</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-0.5">Nombre</label>
          <input
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={state.values?.name ?? ""}
            className="w-full rounded border px-3 py-1.5 text-sm"
          />
          <FieldError errors={state.errors?.name} />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-0.5">Tipo</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="w-full rounded border px-3 py-1.5 text-sm"
          >
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-0.5">
          {kind === "credit"
            ? "Deuda actual (MXN, si aplica) — fija después de crear"
            : "Saldo inicial (MXN) — fijo después de crear"}
        </label>
        <input
          name="openingBalancePesos"
          type="number"
          step="0.01"
          defaultValue={state.values?.openingBalancePesos ?? 0}
          className="w-full rounded border px-3 py-1.5 text-sm"
        />
        <FieldError errors={state.errors?.openingBalancePesos} />
      </div>
      <MetadataFields kind={kind} errors={state.errors} values={state.values} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? "…" : "Crear cuenta"}
        </button>
        {state.ok && <span className="text-green-600 text-sm">✓ Cuenta creada</span>}
      </div>
    </form>
  );
}

// ─── edit form (kind and opening balance are immutable) ────────────────────────

function EditAccountForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const [state, action, pending] = useActionState(
    async (_prev: FormState, fd: FormData): Promise<FormState> => {
      const raw: Record<string, unknown> = {
        name: fd.get("name"),
        bank: fd.get("bank") || null,
        number: fd.get("number") || null,
        expirationMonth: fd.get("expirationMonth") || null,
      };
      if (account.kind === "credit") {
        raw.cutoffDay = Number(fd.get("cutoffDay"));
        raw.paymentDay = Number(fd.get("paymentDay"));
        const limit = fd.get("creditLimitPesos");
        raw.creditLimitPesos = limit ? Number(limit) : null;
      }
      const result = await updateAccountAction(account.id, raw);
      if (result.ok) onClose();
      const attempt = (_prev.attempt ?? 0) + 1;
      return result.ok ? { ...result, attempt } : { ...result, attempt, values: preserveValues(fd) };
    },
    {} as FormState
  );

  return (
    <form key={state.attempt ?? 0} action={action} className="space-y-3 mt-3 border-t pt-3">
      <div>
        <label className="block text-xs text-text-muted mb-0.5">Nombre</label>
        <input
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={state.values?.name ?? account.name}
          className="w-full rounded border px-3 py-1.5 text-sm"
        />
        <FieldError errors={state.errors?.name} />
      </div>
      <MetadataFields
        kind={account.kind}
        defaults={account}
        errors={state.errors}
        values={state.values}
      />
      <FieldError errors={state.errors?._form} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? "…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border px-4 py-1.5 text-sm text-secondary-600 dark:text-secondary-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── account card ───────────────────────────────────────────────────────────────

function AccountCard({ view }: { view: AccountView }) {
  const { account, balancePesos } = view;
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  const meta = [
    account.bank,
    account.number,
    account.expirationDate ? `vig. ${expirationLabel(account.expirationDate)}` : null,
    account.kind === "credit" && account.cutoffDay != null
      ? `corte ${account.cutoffDay} / pago ${account.paymentDay}`
      : null,
    account.kind === "credit" && account.creditLimit != null
      ? `límite ${formatMXN(account.creditLimit / 100)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const kindMeta = ACCOUNT_KIND_META[account.kind];

  return (
    <div className={`rounded-lg border px-4 py-3 ${account.isActive ? "" : "opacity-50"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kindMeta.bgSoft}`}
          >
            <Icon icon={kindMeta.icon} className={`h-5 w-5 ${accountKindTextClass(account.kind)}`} />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {account.name}
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-xs ${kindMeta.bgSoft} ${accountKindTextClass(account.kind)}`}
              >
                {KIND_LABELS[account.kind]}
              </span>
              {!account.isActive && (
                <span className="ml-1 text-xs text-text-muted">(inactiva)</span>
              )}
            </p>
            {meta && <p className="text-xs text-text-muted truncate">{meta}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p
            className={`font-semibold text-sm ${balancePesos < 0 ? "text-negative" : ""}`}
            title="Saldo derivado: inicial + movimientos confirmados"
          >
            {formatMXN(balancePesos)}
          </p>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-primary-700 hover:underline dark:text-primary-400"
          >
            Editar
          </button>
          {account.isActive ? (
            <button
              onClick={() =>
                startTransition(async () => {
                  await deactivateAccountAction(account.id);
                })
              }
              className="text-xs text-text-muted hover:underline"
            >
              Desactivar
            </button>
          ) : (
            <button
              onClick={() =>
                startTransition(async () => {
                  await reactivateAccountAction(account.id);
                })
              }
              className="text-xs text-green-600 hover:underline"
            >
              Reactivar
            </button>
          )}
        </div>
      </div>
      {editing && <EditAccountForm account={account} onClose={() => setEditing(false)} />}
    </div>
  );
}

// ─── page body ──────────────────────────────────────────────────────────────────

export function AccountManager({ accounts }: { accounts: AccountView[] }) {
  const liquid = accounts.filter((v) => v.account.kind !== "credit");
  const credit = accounts.filter((v) => v.account.kind === "credit");
  const liquidTotal = liquid
    .filter((v) => v.account.isActive)
    .reduce((sum, v) => sum + v.balancePesos, 0);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Cuentas líquidas</h2>
          <p className="text-sm text-text-muted">
            Total activas: <span className="font-semibold">{formatMXN(liquidTotal)}</span>
          </p>
        </div>
        {liquid.length === 0 && (
          <p className="text-sm text-text-muted">Sin cuentas líquidas todavía.</p>
        )}
        {liquid.map((v) => (
          <AccountCard key={v.account.id} view={v} />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-lg">Crédito</h2>
        {credit.length === 0 && (
          <p className="text-sm text-text-muted">Sin tarjetas de crédito registradas.</p>
        )}
        {credit.map((v) => (
          <AccountCard key={v.account.id} view={v} />
        ))}
      </section>

      <NewAccountForm />
    </div>
  );
}
