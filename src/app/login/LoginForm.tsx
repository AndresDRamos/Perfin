"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logInAction } from "@/app/actions/auth";
import { PasswordInput } from "@/app/components/PasswordInput";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
  return logInAction({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
}

export function LoginForm() {
  const [state, action, pending] = useActionState(submit, {});

  return (
    <form action={action} className="space-y-4 rounded-lg border p-6">
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

      <PasswordInput
        label="Contraseña"
        name="password"
        autoComplete="current-password"
        error={state.errors?.password?.[0]}
      />

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm text-primary-700 hover:underline dark:text-primary-400">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      {state.errors?._form && (
        <p className="text-red-600 text-sm">{state.errors._form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-primary-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-primary-700 hover:underline dark:text-primary-400">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
