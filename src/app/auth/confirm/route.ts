import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { confirmEmailPossession } from "@/data/auth-write";

// Landing point for every Supabase email link (recovery, email change,
// possession-proof magic link). Handles both link styles so it works with
// stock templates ({{ .ConfirmationURL }} → ?code=...) and token_hash ones
// (?token_hash=...&type=...). The intent query param is ours, set on the
// redirectTo when the mail was requested.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const intent = searchParams.get("intent") ?? type ?? "";

  const supabase = await createClient();

  let verified = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
  }
  if (!verified) {
    return NextResponse.redirect(`${origin}/login?notice=link-invalid`);
  }

  if (intent === "recovery") {
    // The recovery session is now set; the user picks the new password there.
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // email_change: auth.users.email already flipped to the new address —
  // mirror it into profile. verify (magic link): same address, seals
  // email_verified_at. Both funnel through the single sync point.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    await confirmEmailPossession(user.id, user.email);
  }

  const notice = intent === "email_change" ? "email-changed" : "email-verified";
  return NextResponse.redirect(`${origin}/profile?notice=${notice}`);
}
