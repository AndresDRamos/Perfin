import Link from "next/link";
import { requireSessionUser } from "@/data/auth-repo";
import { logOutAction } from "@/app/actions/auth";
import { EmailSection } from "./EmailSection";
import { ChangePasswordForm } from "./ChangePasswordForm";

const NOTICES: Record<string, string> = {
  "email-changed": "Correo actualizado y verificado.",
  "email-verified": "Correo verificado.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [sessionUser, { notice }] = await Promise.all([requireSessionUser(), searchParams]);
  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <main className="mx-auto max-w-sm p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Inicio
        </Link>
      </div>

      {noticeText && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {noticeText}
        </p>
      )}

      <section className="rounded-lg border p-6 space-y-1">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Usuario</p>
        <p className="text-lg font-medium">{sessionUser.username}</p>
        <p className="text-xs text-gray-400">
          Tu nombre visible en Perfin. No se puede cambiar.
        </p>
      </section>

      <EmailSection
        email={sessionUser.email}
        verified={sessionUser.emailVerifiedAt !== null}
      />

      <ChangePasswordForm />

      <form action={logOutAction}>
        <button
          type="submit"
          className="w-full rounded border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
