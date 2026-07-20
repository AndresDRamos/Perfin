import type { CSSProperties } from "react";
import type { AccountKind } from "@/lib/branding/account-kind";

// Constantes visuales del design system (proyecto "Perfin Design System",
// ui_kits/mobile-app). Los componentes del kit usan estilos inline sobre los
// alias planos de globals.css (--surface, --text, --border, …).

export type Accent = "green" | "indigo" | "purple" | "mustard";

// El kit nombra el verde de marca "green"; en los tokens del producto la
// escala vive como primary-*.
function accentScale(accent: Accent): string {
  return accent === "green" ? "primary" : accent;
}

// Círculo pastel (fondo -100) con glifo oscuro (-700) — mismo tratamiento en
// light y dark, como en el kit.
export function accentSoftBg(accent: Accent): string {
  return `var(--color-${accentScale(accent)}-100)`;
}
export function accentStrongFg(accent: Accent): string {
  return `var(--color-${accentScale(accent)}-700)`;
}

export const KIND_ACCENT: Record<AccountKind, Accent> = {
  cash: "green",
  debit: "indigo",
  investment: "purple",
  credit: "mustard",
};

export const EASE_MORPH = "cubic-bezier(0.22, 1, 0.36, 1)";

// ── Estilos de formulario de modal (MorphModal bodies) ──────────────────────

export const modalField: CSSProperties = {
  width: "100%",
  borderRadius: "var(--radius-sm)",
  border: "var(--border-width) solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  padding: "0 12px",
  fontSize: "var(--text-body)",
  fontFamily: "var(--font-sans)",
  height: "var(--control-h)",
  boxSizing: "border-box",
};

export const modalLabel: CSSProperties = {
  display: "block",
  fontSize: "var(--text-caption)",
  color: "var(--text-muted)",
  marginBottom: 4,
};

export const modalPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: "var(--radius-full)",
  background: "var(--surface-muted)",
  color: "var(--text)",
  fontSize: "var(--text-caption)",
  fontWeight: "var(--weight-medium)" as CSSProperties["fontWeight"],
};

// Botón circular delineado (headers de sección, barras de acciones).
export function circleBtn(size: number): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    flexShrink: 0,
    padding: 0,
    border: "var(--border-width) solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    borderRadius: "var(--radius-full)",
    cursor: "pointer",
  };
}

// Rect de viewport usado como origen/destino de los morphs.
export interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function rectOf(el: Element): OriginRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

// ── Fechas (claves locales YYYY-MM-DD, sin corrimiento UTC) ─────────────────

export const MES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MES_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const DIA_ABR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-07-08" → { weekday: "Mié", day: "8", monthLabel: "Jul" }
// La clave se interpreta como fecha de calendario (v1: un solo TZ, días UTC).
export function partsFromKey(key: string): { weekday: string; day: string; monthLabel: string } {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return { weekday: "", day: "", monthLabel: "" };
  const date = new Date(Date.UTC(y, m - 1, d));
  return { weekday: DIA_ABR[date.getUTCDay()], day: String(d), monthLabel: MES_ABR[m - 1] };
}

// "2026-07-08" → "8 Jul"
export function shortDateLabel(key: string): string {
  const [, m, d] = key.split("-").map((n) => parseInt(n, 10));
  if (!m || !d) return key;
  return `${d} ${MES_ABR[m - 1]}`;
}

// "2026-07-08" → "mié, 8 jul" (capitalizado por CSS donde aplique)
export function humanDateLabel(key: string): string {
  const p = partsFromKey(key);
  return `${p.weekday}, ${p.day} ${p.monthLabel}`;
}

// Coincidencia difusa por subsecuencia, insensible a acentos: cada carácter de
// la consulta debe aparecer en orden en el texto ("caf" encuentra "Café…").
export function fuzzyMatch(query: string, text: string): boolean {
  const q = String(query)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
  if (!q) return true;
  const t = String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// Entrada de moneda: solo dígitos; los dos de la derecha son centavos
// ("1" → 0.01, "1234" → 12.34). Nunca se teclea el punto decimal.
export function formatMontoInput(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  const cents = String(parseInt(digits, 10)).padStart(3, "0");
  const intPart = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return intPart + "." + cents.slice(-2);
}

export function montoInputToPesos(monto: string): number {
  const n = parseFloat(monto.replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function pesosToMontoInput(pesos: number): string {
  return formatMontoInput(String(Math.round(Math.abs(pesos) * 100)));
}
