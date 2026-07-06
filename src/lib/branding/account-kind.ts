import type { Account } from "@/data/schema";

export type AccountKind = Account["kind"];

interface AccountKindMeta {
  label: string;
  // Iconify icon id (@iconify/react, mdi set).
  icon: string;
  // Text-safe accent tokens (WCAG AA, >=4.5:1) — see
  // docs/plans/onboarding-dashboard-branding.md for the contrast table.
  textLight: string; // class for light backgrounds
  textDark: string; // class for dark backgrounds
  bgSoft: string; // low-emphasis chip/badge background, both modes
  barClass: string; // solid-fill class (e.g. progress bars) — a literal
  // string, not derived from bgSoft at runtime: Tailwind's build-time class
  // scanner only picks up classes that appear verbatim in source.
}

// Fixed kind -> {icon, accent} mapping. No per-account override exists today
// (confirmed with the dba review): purely a static design decision, not data.
export const ACCOUNT_KIND_META: Record<AccountKind, AccountKindMeta> = {
  cash: {
    label: "Efectivo",
    icon: "mdi:cash",
    textLight: "text-primary-700",
    textDark: "dark:text-primary-300",
    bgSoft: "bg-primary-100 dark:bg-primary-900",
    barClass: "bg-primary-500",
  },
  debit: {
    label: "Débito",
    icon: "mdi:bank",
    textLight: "text-indigo-700",
    textDark: "dark:text-indigo-300",
    bgSoft: "bg-indigo-100 dark:bg-indigo-900",
    barClass: "bg-indigo-500",
  },
  credit: {
    label: "Crédito",
    icon: "mdi:credit-card",
    textLight: "text-mustard-700",
    textDark: "dark:text-mustard-300",
    bgSoft: "bg-mustard-100 dark:bg-mustard-900",
    barClass: "bg-mustard-500",
  },
  investment: {
    label: "Inversión",
    icon: "mdi:chart-finance",
    textLight: "text-purple-500",
    textDark: "dark:text-purple-300",
    bgSoft: "bg-purple-100 dark:bg-purple-900",
    barClass: "bg-purple-500",
  },
};

export function accountKindTextClass(kind: AccountKind): string {
  const meta = ACCOUNT_KIND_META[kind];
  return `${meta.textLight} ${meta.textDark}`;
}
