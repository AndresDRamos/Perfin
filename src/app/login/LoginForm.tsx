"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logInAction } from "@/app/actions/auth";

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
        <label className="block text-sm font-medium">Usuario o correo</label>
        <input
          name="identifier"
          type="text"
          required
          autoComplete="username"
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.identifier && (
          <p className="text-red-600 text-xs mt-1">{state.errors.identifier[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.password && (
          <p className="text-red-600 text-xs mt-1">{state.errors.password[0]}</p>
        )}
      </div>

      {state.errors?._form && (
        <p className="text-red-600 text-sm">{state.errors._form[0]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-blue-600 hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
