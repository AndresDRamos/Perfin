import { LoginForm } from "./LoginForm";

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
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">Perfin</h1>
      {noticeText && (
        <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {noticeText}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
