import { RegisterForm } from "./RegisterForm";
import { Logo } from "@/app/components/Logo";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-sm p-6 pt-8 sm:p-8">
      <Logo size={36} className="mb-4 w-full justify-center" />
      <RegisterForm />
    </main>
  );
}
