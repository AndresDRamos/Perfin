"use server";

import { redirect } from "next/navigation";
import {
  signUpSchema,
  logInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  emailChangeSchema,
  signUp,
  logIn,
  logOut,
  requestPasswordReset,
  resetPassword,
  changePassword,
  requestEmailChange,
  sendVerificationEmail,
} from "@/data/auth-write";
import { requireSessionUser } from "@/data/auth-repo";

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

// Always resolves to the same generic ok — never reveals whether the
// identifier exists or has an email (see requestPasswordReset).
export async function forgotPasswordAction(raw: unknown) {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await requestPasswordReset(parsed.data);
  } catch {
    // Deliberately swallowed: an error path with a different response would
    // be an enumeration oracle. The generic notice covers this case too.
  }
  return { ok: true as const };
}

export async function resetPasswordAction(raw: unknown) {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await resetPassword(parsed.data);
  } catch (e) {
    return {
      ok: false as const,
      errors: { _form: [e instanceof Error ? e.message : "No se pudo restablecer la contraseña"] },
    };
  }
  redirect("/");
}

export async function changePasswordAction(raw: unknown) {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const user = await requireSessionUser();
    await changePassword(user.userId, parsed.data);
  } catch (e) {
    return {
      ok: false as const,
      errors: { _form: [e instanceof Error ? e.message : "No se pudo cambiar la contraseña"] },
    };
  }
  return { ok: true as const };
}

export async function requestEmailChangeAction(raw: unknown) {
  const parsed = emailChangeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const user = await requireSessionUser();
    await requestEmailChange(user.userId, parsed.data);
  } catch (e) {
    return {
      ok: false as const,
      errors: { _form: [e instanceof Error ? e.message : "No se pudo iniciar el cambio de correo"] },
    };
  }
  return { ok: true as const };
}

export async function sendVerificationEmailAction() {
  try {
    const user = await requireSessionUser();
    await sendVerificationEmail(user.userId);
  } catch (e) {
    return {
      ok: false as const,
      errors: { _form: [e instanceof Error ? e.message : "No se pudo enviar el correo"] },
    };
  }
  return { ok: true as const };
}
