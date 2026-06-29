import { describe, it, expect } from "vitest";
import { money, add, subtract, negate, fromPesos, format, ZERO } from "../money";

describe("money", () => {
  it("crea centavos enteros", () => {
    expect(money(1500)).toBe(1500);
  });

  it("rechaza floats", () => {
    expect(() => money(15.5)).toThrow();
  });

  it("ZERO es 0", () => {
    expect(ZERO).toBe(0);
  });
});

describe("add", () => {
  it("suma correctamente", () => {
    expect(add(money(100), money(200))).toBe(300);
  });

  it("suma con negativos", () => {
    expect(add(money(500), money(-200))).toBe(300);
  });
});

describe("subtract", () => {
  it("resta correctamente", () => {
    expect(subtract(money(500), money(200))).toBe(300);
  });
});

describe("negate", () => {
  it("niega un valor positivo", () => {
    expect(negate(money(300))).toBe(-300);
  });

  it("niega un valor negativo", () => {
    expect(negate(money(-300))).toBe(300);
  });
});

describe("fromPesos", () => {
  it("convierte pesos a centavos", () => {
    expect(fromPesos(15)).toBe(1500);
  });

  it("redondea correctamente", () => {
    expect(fromPesos(15.999)).toBe(1600);
    expect(fromPesos(15.004)).toBe(1500);
  });
});

describe("format", () => {
  it("formatea en MXN", () => {
    const result = format(money(150000)); // $1,500.00
    expect(result).toContain("1");
    expect(result).toContain("500");
  });
});
