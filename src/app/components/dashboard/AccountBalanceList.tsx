"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import type { AccountCardView } from "@/app/actions/dashboard";
import { ACCOUNT_KIND_META, accountKindTextClass, type AccountKind } from "@/lib/branding/account-kind";
import { formatMXN } from "./ui";

interface Props {
  accounts: AccountCardView[];
  onCapture: (account: AccountCardView) => void; // open contextual EntryModal
}

// Fixed display order (plan decision 5): cash → debit → investment → credit.
const KIND_ORDER: AccountKind[] = ["cash", "debit", "investment", "credit"];

export function AccountBalanceList({ accounts, onCapture }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saldos</h2>
        <Link
          href="/accounts"
          className="rounded px-2 py-1.5 text-sm text-primary-700 hover:underline dark:text-primary-400"
        >
          + Añadir o editar
        </Link>
      </div>

      {KIND_ORDER.map((kind) => {
        const group = accounts.filter((a) => a.kind === kind);
        if (group.length === 0) return null;
        const meta = ACCOUNT_KIND_META[kind];
        return (
          <div key={kind} className="space-y-1.5">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-secondary-600 dark:text-secondary-300">
              <Icon icon={meta.icon} className={`h-4 w-4 ${accountKindTextClass(kind)}`} />
              {meta.label}
            </h3>
            {group.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onCapture(a)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bgSoft}`}
                  >
                    <Icon icon={meta.icon} className={`h-4.5 w-4.5 ${accountKindTextClass(kind)}`} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    {a.bank && (
                      <p className="truncate text-xs text-secondary-600 dark:text-secondary-300">
                        {a.bank}
                      </p>
                    )}
                  </div>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold ${
                    a.balancePesos < 0 ? "text-red-600" : ""
                  }`}
                >
                  {formatMXN(a.balancePesos)}
                </p>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
