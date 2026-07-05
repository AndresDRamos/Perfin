import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { profile } from "./schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Synthetic domain for username-only signups — never a real mailbox, never
// shown to the user. login_email mirrors whatever auth.users.email actually is.
const SYNTHETIC_EMAIL_DOMAIN = "users.perfin.internal";

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

export const signUpSchema = z.object({
  username: usernameSchema,
  displayName: z.string().min(1).max(100),
  email: z.string().email({ message: "Correo inválido" }).optional(),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  identifier: z.string().min(1, { message: "Ingresa tu usuario o correo" }),
  password: z.string().min(1, { message: "Ingresa tu contraseña" }),
});

export type LogInInput = z.infer<typeof logInSchema>;

export interface SessionIdentity {
  userId: string;
  username: string;
  displayName: string;
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
// hasRealEmail only tracks whether we have a legitimate contact address for
// future features (password reset, notifications); it is not a login gate.
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
      displayName: parsed.displayName,
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

  return { userId: data.user.id, username: parsed.username, displayName: parsed.displayName };
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
