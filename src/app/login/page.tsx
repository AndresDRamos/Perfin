import { LoginForm } from "./LoginForm";
import { Logo } from "@/app/components/Logo";

const NOTICES: Record<string, string> = {
  "link-invalid": "El enlace expiró o no es válido. Inicia sesión o solicita uno nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <main className="mx-auto max-w-sm p-6 pt-10 sm:p-8">
      <Logo size={40} className="mb-6 w-full justify-center" />
      {noticeText && (
        <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {noticeText}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
