import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /auth/confirm, /forgot-password and /reset-password must stay reachable
// without a session: they ARE the way back in when the user lost theirs.
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/confirm",
];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

// Refreshes the Supabase session cookie on every request and redirects
// unauthenticated requests away from protected routes. Must run before any
// Server Component reads cookies (Next.js middleware convention).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Direct process.env access, not the shared server env.ts — see client.ts
  // for why (Edge middleware shouldn't pull in unrelated server secrets/DB
  // URL validation just to read two public values).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
