"use client";

import { useActionState, useState } from "react";
import {
  requestEmailChangeAction,
  sendVerificationEmailAction,
} from "@/app/actions/auth";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

interface EmailSectionProps {
  email: string | null; // null = synthetic-only account
  verified: boolean;
}

async function submitChange(_prev: FormState, formData: FormData): Promise<FormState> {
  return requestEmailChangeAction({ email: formData.get("email") });
}

async function submitVerify(): Promise<FormState> {
  return sendVerificationEmailAction();
}

export function EmailSection({ email, verified }: EmailSectionProps) {
  const [editing, setEditing] = useState(false);
  const [changeState, changeAction, changePending] = useActionState(submitChange, {});
  const [verifyState, verifyAction, verifyPending] = useActionState(submitVerify, {});

  return (
    <section className="rounded-lg border p-6 space-y-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">Correo</p>

      {email ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium break-all">{email}</p>
          {verified ? (
            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              Verificado
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
              Sin verificar
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Tu cuenta no tiene correo. Sin correo no puedes recuperar tu contraseña si la
          olvidas.
        </p>
      )}

      {email && !verified && !changeState.ok && (
        <form action={verifyAction}>
          {verifyState.ok ? (
            <p className="text-sm text-green-700">
              Enlace enviado. Ábrelo desde tu correo para verificarlo.
            </p>
          ) : (
            <button
              type="submit"
              disabled={verifyPending}
              className="w-full rounded border py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50 dark:text-primary-400 dark:hover:bg-primary-900"
            >
              {verifyPending ? "Enviando…" : "Enviar enlace de verificación"}
            </button>
          )}
          {verifyState.errors?._form && (
            <p className="text-red-600 text-xs mt-1">{verifyState.errors._form[0]}</p>
          )}
        </form>
      )}

      {changeState.ok ? (
        <p className="text-sm text-green-700">
          Te enviamos un enlace de confirmación al correo nuevo. El cambio se aplica al
          abrirlo.
        </p>
      ) : editing ? (
        <form action={changeAction} className="space-y-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="email">
              {email ? "Correo nuevo" : "Correo"}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
            {changeState.errors?.email && (
              <p className="text-red-600 text-xs mt-1">{changeState.errors.email[0]}</p>
            )}
          </div>
          {changeState.errors?._form && (
            <p className="text-red-600 text-sm">{changeState.errors._form[0]}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={changePending}
              className="flex-1 rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {changePending ? "Enviando…" : "Enviar confirmación"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border px-4 py-2.5 text-sm text-secondary-600 dark:text-secondary-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded border py-2.5 text-sm font-medium text-secondary-700 hover:bg-secondary-100 dark:text-secondary-200 dark:hover:bg-secondary-800"
        >
          {email ? "Cambiar correo" : "Añadir correo"}
        </button>
      )}
    </section>
  );
}
