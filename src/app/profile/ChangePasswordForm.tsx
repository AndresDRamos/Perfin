"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { PasswordInput } from "@/app/components/PasswordInput";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
  return changePasswordAction({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
}

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(submit, {});

  return (
    <section className="rounded-lg border p-6 space-y-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">Contraseña</p>

      {state.ok ? (
        <p className="text-sm text-green-700">Contraseña actualizada.</p>
      ) : open ? (
        <form action={action} className="space-y-3">
          <PasswordInput
            label="Contraseña actual"
            name="currentPassword"
            autoComplete="current-password"
            error={state.errors?.currentPassword?.[0]}
          />
          <PasswordInput
            label="Contraseña nueva"
            name="password"
            autoComplete="new-password"
            minLength={8}
            error={state.errors?.password?.[0]}
          />
          <PasswordInput
            label="Confirmar contraseña nueva"
            name="passwordConfirm"
            autoComplete="new-password"
            minLength={8}
            error={state.errors?.passwordConfirm?.[0]}
          />
          {state.errors?._form && (
            <p className="text-red-600 text-sm">{state.errors._form[0]}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border px-4 py-2.5 text-sm text-secondary-600 dark:text-secondary-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded border py-2.5 text-sm font-medium text-secondary-700 hover:bg-secondary-100 dark:text-secondary-200 dark:hover:bg-secondary-800"
        >
          Cambiar contraseña
        </button>
      )}
    </section>
  );
}
