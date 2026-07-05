import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client — bypasses RLS and can call the Admin API. Used ONLY by
// auth-write.signUp to create users with email_confirm forced (v1 has no
// email-delivery pipeline: everyone gets in immediately, real or synthetic
// email; see docs/plans/auth-spaces.md decision 1). Never import from a
// client component or a route reachable without the "use server" boundary.
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
