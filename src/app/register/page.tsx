import { RegisterForm } from "./RegisterForm";
import { Logo } from "@/app/components/Logo";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <Logo className="mb-6" />
      <RegisterForm />
    </main>
  );
}
