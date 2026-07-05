import { createBrowserClient } from "@supabase/ssr";

// Direct process.env access (not the shared server env.ts): Next.js only
// inlines NEXT_PUBLIC_* vars into the browser bundle when referenced as a
// literal `process.env.NEXT_PUBLIC_X` expression here, and env.ts also
// validates server-only secrets that don't exist in the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
