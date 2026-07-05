import { eq } from "drizzle-orm";
import { db } from "./db";
import { profile } from "./schema";
import { createClient } from "@/lib/supabase/server";
import { confirmEmailPossession, isSyntheticEmail } from "./auth-write";
import type { SessionIdentity } from "./auth-write";

// Server-side only. getUser() re-validates the JWT against Supabase (unlike
// getSession(), which trusts the cookie as-is) — the right call before using
// the identity to scope a data query.
export async function getSessionUser(): Promise<SessionIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [row] = await db
    .select({
      username: profile.username,
      loginEmail: profile.loginEmail,
      hasRealEmail: profile.hasRealEmail,
      emailVerifiedAt: profile.emailVerifiedAt,
    })
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);
  if (!row) return null;

  // Self-repair: a confirmed email change updates auth.users.email first and
  // profile via the /auth/confirm callback second — if that callback died
  // halfway, the mirror drifts. Reconcile here (only fires on actual drift).
  if (user.email && user.email.toLowerCase() !== row.loginEmail.toLowerCase()) {
    await confirmEmailPossession(user.id, user.email);
    return {
      userId: user.id,
      username: row.username,
      email: isSyntheticEmail(user.email) ? null : user.email,
      emailVerifiedAt: isSyntheticEmail(user.email) ? row.emailVerifiedAt : new Date(),
    };
  }

  return {
    userId: user.id,
    username: row.username,
    email: row.hasRealEmail ? row.loginEmail : null,
    emailVerifiedAt: row.emailVerifiedAt,
  };
}

// For server actions: throws instead of returning null. Middleware already
// keeps unauthenticated requests off protected routes, so reaching a server
// action without a session means the request bypassed it (or the cookie
// expired mid-session) — fail loudly rather than silently scoping to nothing.
export async function requireSessionUser(): Promise<SessionIdentity> {
  const user = await getSessionUser();
  if (!user) throw new Error("No hay sesión activa");
  return user;
}
