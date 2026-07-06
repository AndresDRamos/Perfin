import { ResetPasswordForm } from "./ResetPasswordForm";
import { Logo } from "@/app/components/Logo";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <Logo className="mb-6" />
      <ResetPasswordForm />
    </main>
  );
}
