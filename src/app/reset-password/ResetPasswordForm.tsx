"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { PasswordInput } from "@/app/components/PasswordInput";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
  return resetPasswordAction({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
}

// Reached from the recovery link (/auth/confirm?intent=recovery just set the
// recovery session). Without that session the action fails with a clear
// "link expired" message rather than silently doing nothing.
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(submit, {});

  return (
    <form action={action} className="space-y-4 rounded-lg border p-6">
      <div>
        <h2 className="font-medium">Nueva contraseña</h2>
        <p className="text-sm text-text-muted mt-1">Elige tu nueva contraseña.</p>
      </div>

      <PasswordInput
        label="Contraseña"
        name="password"
        autoComplete="new-password"
        minLength={8}
        error={state.errors?.password?.[0]}
      />

      <PasswordInput
        label="Confirmar contraseña"
        name="passwordConfirm"
        autoComplete="new-password"
        minLength={8}
        error={state.errors?.passwordConfirm?.[0]}
      />

      {state.errors?._form && (
        <p className="text-negative text-sm">{state.errors._form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>

      <p className="text-center text-sm text-text-muted">
        <Link href="/forgot-password" className="text-primary-700 hover:underline dark:text-primary-400">
          Solicitar un enlace nuevo
        </Link>
      </p>
    </form>
  );
}
