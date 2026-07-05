import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { profile } from "./schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

// Synthetic domain for username-only signups — never a real mailbox, never
// shown to the user. login_email mirrors whatever auth.users.email actually is.
const SYNTHETIC_EMAIL_DOMAIN = "users.perfin.internal";

export function isSyntheticEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

// Case-insensitive on input: users type whatever's memorable ("AnaRamos"),
// we lowercase before validating against chk_username_format in profile.ts /
// the DB CHECK constraint (which only ever sees lowercase, so it never
// rejects anything that gets past this transform).
const usernameSchema = z
  .string()
  .transform((s) => s.toLowerCase())
  .pipe(
    z.string().regex(/^[a-z0-9_]{3,30}$/, {
      message: "Usuario: 3-30 caracteres, sin espacios ni acentos",
    })
  );

const passwordSchema = z
  .string()
  .min(8, { message: "La contraseña debe tener al menos 8 caracteres" });

// Every "set a password" form (signup, reset, change) carries the same
// password + passwordConfirm pair and the same mismatch error.
const PASSWORDS_MISMATCH = {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirm"],
};

export const signUpSchema = z
  .object({
    username: usernameSchema,
    email: z.string().email({ message: "Correo inválido" }).optional(),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, PASSWORDS_MISMATCH);

export type SignUpInput = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  identifier: z.string().min(1, { message: "Ingresa tu usuario o correo" }),
  password: z.string().min(1, { message: "Ingresa tu contraseña" }),
});

export type LogInInput = z.infer<typeof logInSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, { message: "Ingresa tu usuario o correo" }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, PASSWORDS_MISMATCH);

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Ingresa tu contraseña actual" }),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, PASSWORDS_MISMATCH);

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const emailChangeSchema = z.object({
  email: z.string().email({ message: "Correo inválido" }),
});

export type EmailChangeInput = z.infer<typeof emailChangeSchema>;

// The username IS the visible name app-wide (display_name dropped in 0005).
// email is null when the account only has the synthetic placeholder.
export interface SessionIdentity {
  userId: string;
  username: string;
  email: string | null;
  emailVerifiedAt: Date | null;
}

async function usernameOrEmailTaken(username: string, loginEmail: string): Promise<boolean> {
  const rows = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(sql`lower(${profile.username}) = lower(${username}) OR lower(${profile.loginEmail}) = lower(${loginEmail})`);
  return rows.length > 0;
}

// Creates the auth.users row (Admin API) + the matching profile row, then
// signs the new user in (sets the session cookie via the server client).
//
// v1 has no email-delivery pipeline (no SMTP/templates configured), so every
// user is created with email_confirm forced to true — real or synthetic
// email, nobody is blocked behind a confirmation link they can't receive.
// hasRealEmail only tracks whether we have a legitimate contact address;
// emailVerifiedAt stays NULL until the user proves mailbox possession from
// /profile (ADR-008) — it is not a login gate.
export async function signUp(input: SignUpInput): Promise<SessionIdentity> {
  const parsed = signUpSchema.parse(input);
  const hasRealEmail = parsed.email !== undefined;
  const loginEmail = hasRealEmail
    ? parsed.email!
    : `${parsed.username}@${SYNTHETIC_EMAIL_DOMAIN}`;

  if (await usernameOrEmailTaken(parsed.username, loginEmail)) {
    throw new Error("Ese usuario o correo ya está registrado");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: loginEmail,
    password: parsed.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "No se pudo crear el usuario");
  }

  try {
    await db.insert(profile).values({
      userId: data.user.id,
      username: parsed.username,
      loginEmail,
      hasRealEmail,
    });
  } catch (e) {
    // Roll back the orphaned auth user so a failed profile insert (e.g. a
    // race on the unique indexes) doesn't leave an unusable identity behind.
    await admin.auth.admin.deleteUser(data.user.id);
    throw e;
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: parsed.password,
  });
  if (signInError) throw new Error(signInError.message);

  return {
    userId: data.user.id,
    username: parsed.username,
    email: hasRealEmail ? loginEmail : null,
    emailVerifiedAt: null,
  };
}

// Resolves username OR email to the login_email Supabase actually knows,
// then signs in. Errors are deliberately generic (never reveal whether the
// identifier exists) to avoid a username/email enumeration oracle.
export async function logIn(input: LogInInput): Promise<void> {
  const parsed = logInSchema.parse(input);

  const [row] = await db
    .select({ loginEmail: profile.loginEmail })
    .from(profile)
    .where(
      sql`lower(${profile.username}) = lower(${parsed.identifier}) OR lower(${profile.loginEmail}) = lower(${parsed.identifier})`
    )
    .limit(1);

  const INVALID_CREDENTIALS = "Usuario/correo o contraseña incorrectos";
  if (!row) throw new Error(INVALID_CREDENTIALS);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: row.loginEmail,
    password: parsed.password,
  });
  if (error) throw new Error(INVALID_CREDENTIALS);
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// Sends the recovery link — but only when the identifier resolves to an
// account with a real email. Always resolves without revealing anything:
// the caller shows the same generic notice whether or not a mail went out
// (same no-enumeration-oracle policy as logIn). Username-only accounts
// simply can't recover in v1 (documented limitation, ADR-008).
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const parsed = forgotPasswordSchema.parse(input);

  const [row] = await db
    .select({ loginEmail: profile.loginEmail, hasRealEmail: profile.hasRealEmail })
    .from(profile)
    .where(
      sql`lower(${profile.username}) = lower(${parsed.identifier}) OR lower(${profile.loginEmail}) = lower(${parsed.identifier})`
    )
    .limit(1);
  if (!row || !row.hasRealEmail) return;

  const supabase = await createClient();
  // Errors (rate limit, transient SMTP) are swallowed on purpose: surfacing
  // them would leak that the identifier exists and has an email.
  await supabase.auth.resetPasswordForEmail(row.loginEmail, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?intent=recovery`,
  });
}

// Runs inside the recovery session /auth/confirm just established.
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const parsed = resetPasswordSchema.parse(input);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("El enlace expiró o no es válido. Solicita uno nuevo.");
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) throw new Error(error.message);
}

// Re-authenticates with the current password before updating — updateUser
// alone would let anyone with a stolen session cookie rotate the password.
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const parsed = changePasswordSchema.parse(input);

  const [row] = await db
    .select({ loginEmail: profile.loginEmail })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);
  if (!row) throw new Error("Perfil no encontrado");

  const supabase = await createClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: row.loginEmail,
    password: parsed.currentPassword,
  });
  if (reauthError) throw new Error("La contraseña actual es incorrecta");

  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) throw new Error(error.message);
}

// Starts the add/change-email flow: Supabase mails a confirmation link to the
// NEW address only ("Secure email change" must be OFF — the old address may
// be synthetic and nobody would ever read that link). Nothing in profile
// changes until /auth/confirm consumes the link (confirmEmailPossession).
export async function requestEmailChange(userId: string, input: EmailChangeInput): Promise<void> {
  const parsed = emailChangeSchema.parse(input);

  if (isSyntheticEmail(parsed.email)) {
    throw new Error("Correo inválido");
  }

  // Supabase only checks uniqueness against auth.users at confirmation time;
  // profile.login_email must be checked here or the eventual reconcile would
  // blow up on profile_login_email_lower_uq.
  const [taken] = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(
      sql`lower(${profile.loginEmail}) = lower(${parsed.email}) AND ${profile.userId} <> ${userId}`
    )
    .limit(1);
  if (taken) throw new Error("Ese correo ya está registrado");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.email },
    { emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?intent=email_change` }
  );
  if (error) throw new Error(error.message);
}

// Sends a possession-proof link (magic link) to the account's current real
// email — for addresses given at signup, which were force-confirmed via the
// Admin API and therefore never proved anything (ADR-008).
export async function sendVerificationEmail(userId: string): Promise<void> {
  const [row] = await db
    .select({
      loginEmail: profile.loginEmail,
      hasRealEmail: profile.hasRealEmail,
      emailVerifiedAt: profile.emailVerifiedAt,
    })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);
  if (!row || !row.hasRealEmail) {
    throw new Error("Tu cuenta no tiene un correo asociado; añade uno primero");
  }
  if (row.emailVerifiedAt) return; // already verified — nothing to send

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: row.loginEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?intent=verify`,
    },
  });
  if (error) throw new Error(error.message);
}

// Single sync point for "this user just proved they own authEmail": seals
// email_verified_at and mirrors auth.users.email into profile. Used by the
// /auth/confirm callback (email_change + verify) and by auth-repo's
// self-repair when a confirmation landed but its callback died halfway.
// All three fields move together so chk_email_verified_real and
// chk_login_email_domain hold by construction.
export async function confirmEmailPossession(userId: string, authEmail: string): Promise<void> {
  if (isSyntheticEmail(authEmail)) return; // possession of the placeholder proves nothing

  await db
    .update(profile)
    .set({
      loginEmail: authEmail,
      hasRealEmail: true,
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, userId));
}
