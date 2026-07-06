"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { PasswordInput } from "@/app/components/PasswordInput";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get("email");
  return signUpAction({
    username: formData.get("username"),
    email: email ? email : undefined,
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(submit, {});

  return (
    <form action={action} className="space-y-4 rounded-lg border p-6">
      <div>
        <label className="block text-sm font-medium" htmlFor="username">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          pattern="[A-Za-z0-9_]{3,30}"
          title="3-30 caracteres, sin espacios ni acentos (mayúsculas y minúsculas se tratan igual)"
          autoComplete="username"
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Será tu nombre visible en Perfin.</p>
        {state.errors?.username && (
          <p className="text-red-600 text-xs mt-1">{state.errors.username[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="email">
          Correo <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          Sin correo no podrás recuperar tu contraseña si la olvidas.
        </p>
        {state.errors?.email && (
          <p className="text-red-600 text-xs mt-1">{state.errors.email[0]}</p>
        )}
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
        <p className="text-red-600 text-sm">{state.errors._form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary-700 hover:underline dark:text-primary-400">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
