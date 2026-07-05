"use server";

import { redirect } from "next/navigation";
import { signUpSchema, logInSchema, signUp, logIn, logOut } from "@/data/auth-write";

export async function signUpAction(raw: unknown) {
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await signUp(parsed.data);
  } catch (e) {
    return {
      ok: false as const,
      errors: { _form: [e instanceof Error ? e.message : "Error al registrar"] },
    };
  }
  redirect("/");
}

export async function logInAction(raw: unknown) {
  const parsed = logInSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await logIn(parsed.data);
  } catch (e) {
    return {
      ok: false as const,
      errors: { _form: [e instanceof Error ? e.message : "Error al iniciar sesión"] },
    };
  }
  redirect("/");
}

export async function logOutAction() {
  await logOut();
  redirect("/login");
}
