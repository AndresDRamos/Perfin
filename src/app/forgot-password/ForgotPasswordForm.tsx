"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
  return forgotPasswordAction({ identifier: formData.get("identifier") });
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(submit, {});

  // The success message is deliberately generic — it never confirms whether
  // the identifier exists or has an email (no enumeration oracle).
  if (state.ok) {
    return (
      <div className="space-y-4 rounded-lg border p-6">
        <h2 className="font-medium">Revisa tu correo</h2>
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          Si la cuenta tiene un correo asociado, enviamos un enlace para restablecer la
          contraseña. El enlace expira pronto; si no llega, revisa spam o intenta de nuevo.
        </p>
        <p className="text-sm text-gray-500">
          <Link href="/login" className="text-primary-700 hover:underline dark:text-primary-400">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-lg border p-6">
      <div>
        <h2 className="font-medium">Recuperar contraseña</h2>
        <p className="text-sm text-gray-500 mt-1">
          Te enviaremos un enlace al correo asociado a tu cuenta.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="identifier">
          Usuario o correo
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
        {state.errors?.identifier && (
          <p className="text-red-600 text-xs mt-1">{state.errors.identifier[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-primary-700 hover:underline dark:text-primary-400">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
