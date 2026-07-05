import { describe, it, expect } from "vitest";
import {
  signUpSchema,
  resetPasswordSchema,
  changePasswordSchema,
  emailChangeSchema,
  forgotPasswordSchema,
  isSyntheticEmail,
} from "../auth-write";

// ─── confirmación de contraseña (refine compartido) ──────────────────────────────

describe("Zod — signUpSchema (confirmación de contraseña)", () => {
  const base = { username: "ana_ramos", password: "supersecreta", passwordConfirm: "supersecreta" };

  it("acepta cuando ambas contraseñas coinciden", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza cuando no coinciden, con el error en passwordConfirm", () => {
    const r = signUpSchema.safeParse({ ...base, passwordConfirm: "otradistinta" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.passwordConfirm).toBeDefined();
    }
  });

  it("rechaza contraseña corta aunque la confirmación coincida", () => {
    const r = signUpSchema.safeParse({ ...base, password: "corta", passwordConfirm: "corta" });
    expect(r.success).toBe(false);
  });

  it("normaliza el username a minúsculas (case-insensitive al escribir)", () => {
    const r = signUpSchema.safeParse({ ...base, username: "AnaRamos" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.username).toBe("anaramos");
  });

  it("el correo sigue siendo opcional", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, email: "ana@example.com" }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, email: "no-es-correo" }).success).toBe(false);
  });
});

describe("Zod — resetPasswordSchema / changePasswordSchema", () => {
  it("reset: exige coincidencia y mínimo 8", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "supersecreta", passwordConfirm: "supersecreta" })
        .success
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ password: "supersecreta", passwordConfirm: "distinta1" })
        .success
    ).toBe(false);
  });

  it("change: exige la contraseña actual además del par nuevo", () => {
    const ok = changePasswordSchema.safeParse({
      currentPassword: "laactual",
      password: "lanuevaclave",
      passwordConfirm: "lanuevaclave",
    });
    expect(ok.success).toBe(true);

    const sinActual = changePasswordSchema.safeParse({
      currentPassword: "",
      password: "lanuevaclave",
      passwordConfirm: "lanuevaclave",
    });
    expect(sinActual.success).toBe(false);
  });
});

// ─── identificadores y correos ────────────────────────────────────────────────────

describe("Zod — forgotPasswordSchema / emailChangeSchema", () => {
  it("forgot: acepta cualquier identificador no vacío (username o correo)", () => {
    expect(forgotPasswordSchema.safeParse({ identifier: "ana_ramos" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ identifier: "ana@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ identifier: "" }).success).toBe(false);
  });

  it("emailChange: solo correos válidos", () => {
    expect(emailChangeSchema.safeParse({ email: "nuevo@example.com" }).success).toBe(true);
    expect(emailChangeSchema.safeParse({ email: "sin-arroba" }).success).toBe(false);
  });
});

describe("isSyntheticEmail", () => {
  it("detecta el dominio sintético, case-insensitive", () => {
    expect(isSyntheticEmail("ana_ramos@users.perfin.internal")).toBe(true);
    expect(isSyntheticEmail("ANA_RAMOS@USERS.PERFIN.INTERNAL")).toBe(true);
  });

  it("no marca correos reales", () => {
    expect(isSyntheticEmail("ana@example.com")).toBe(false);
    // dominio parecido pero no el placeholder exacto
    expect(isSyntheticEmail("ana@users.perfin.internal.example.com")).toBe(false);
  });
});
