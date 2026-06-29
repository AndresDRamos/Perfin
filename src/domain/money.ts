// Integer minor units (centavos, MXN). Never a float.
// All monetary values throughout the app are of this type.
export type Money = number & { readonly _brand: "Money" };

export const ZERO: Money = 0 as Money;

export function money(centavos: number): Money {
  if (!Number.isInteger(centavos)) {
    throw new Error(`Money must be integer centavos, got ${centavos}`);
  }
  return centavos as Money;
}

export function add(a: Money, b: Money): Money {
  return (a + b) as Money;
}

export function subtract(a: Money, b: Money): Money {
  return (a - b) as Money;
}

export function negate(m: Money): Money {
  // Guard against -0 (IEEE 754 artifact; not a valid financial amount)
  return (m === 0 ? 0 : -m) as Money;
}

export function lessThan(a: Money, b: Money): boolean {
  return a < b;
}

export function greaterThan(a: Money, b: Money): boolean {
  return a > b;
}

// Use only at user-input boundaries (e.g. parsing a form field).
export function fromPesos(pesos: number): Money {
  return money(Math.round(pesos * 100));
}

export function toPesos(m: Money): number {
  return m / 100;
}

export function format(m: Money): string {
  return (m / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
