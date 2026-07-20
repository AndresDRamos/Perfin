"use client";

import type { AccountCardView, EntryView } from "@/app/actions/dashboard";
import { ACCOUNT_KIND_META } from "@/lib/branding/account-kind";
import { KIND_ACCENT, partsFromKey, shortDateLabel } from "@/app/components/ui/kit";
import type { KitTx } from "@/app/components/ui/ExpandableRow";
import { formatMXN } from "./ui";

export { partsFromKey };

// Monto firmado de una entry vista desde una cuenta concreta: income suma,
// expense resta; una transferencia resta en la cuenta origen y suma en la
// destino (contrato de piernas firmadas de ledger-mapping).
export function signedPesosForAccount(e: EntryView, accountId: number): number {
  if (e.kind === "income") return e.amountPesos;
  if (e.kind === "expense") return -e.amountPesos;
  return e.accountId === accountId ? -e.amountPesos : e.amountPesos;
}

function conceptFallback(e: EntryView): string {
  if (e.concept) return e.concept;
  if (e.kind === "transfer") return "Transferencia";
  if (e.kind === "income") return e.categoryName ?? "Ingreso";
  return e.categoryName ?? "Gasto";
}

function amountLabel(signed: number): string {
  return `${signed < 0 ? "−" : "+"}${formatMXN(Math.abs(signed))}`;
}

// Fila del kit vista desde una CUENTA: el badge cruzado es la categoría (o la
// contraparte de la transferencia).
export function kitTxForAccount(e: EntryView, accountId: number): KitTx {
  const signed = signedPesosForAccount(e, accountId);
  let meta: KitTx["meta"];
  if (e.kind === "transfer") {
    const other = e.accountId === accountId ? e.toAccountName : e.accountName;
    meta = { icon: "mdi:swap-horizontal", accent: "indigo", label: other ?? "Transferencia" };
  } else if (e.categoryName) {
    meta =
      e.kind === "income"
        ? { icon: "mdi:cash-plus", accent: "green", label: e.categoryName }
        : { icon: "mdi:tag-outline", accent: "mustard", label: e.categoryName };
  }
  return {
    id: e.id,
    concepto: conceptFallback(e),
    fechaKey: e.date,
    fechaLabel: shortDateLabel(e.date),
    amountLabel: amountLabel(signed),
    amountAbs: Math.abs(signed),
    positive: signed > 0,
    negative: signed < 0,
    projected: e.status === "projected",
    meta,
  };
}

// Fila del kit vista desde una CATEGORÍA de gasto: el badge cruzado es la
// cuenta (ícono y acento por tipo de cuenta).
export function kitTxForCategory(e: EntryView, accounts: AccountCardView[]): KitTx {
  const acct = accounts.find((a) => a.id === e.accountId);
  const meta = acct
    ? {
        icon: ACCOUNT_KIND_META[acct.kind].icon,
        accent: KIND_ACCENT[acct.kind],
        label: acct.name,
      }
    : undefined;
  return {
    id: e.id,
    concepto: conceptFallback(e),
    fechaKey: e.date,
    fechaLabel: shortDateLabel(e.date),
    amountLabel: `−${formatMXN(e.amountPesos)}`,
    amountAbs: e.amountPesos,
    positive: false,
    negative: true,
    projected: e.status === "projected",
    meta,
  };
}
