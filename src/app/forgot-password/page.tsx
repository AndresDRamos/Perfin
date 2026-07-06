import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { Logo } from "@/app/components/Logo";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <Logo className="mb-6" />
      <ForgotPasswordForm />
    </main>
  );
}
