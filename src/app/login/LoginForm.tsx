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
    <>
      <form action={action} className="space-y-4 rounded-md border border-border p-5">
        <div>
          <label className="mb-1 block text-caption text-text-muted" htmlFor="identifier">
            Usuario o correo
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            className="h-11 w-full rounded-sm border border-border bg-transparent px-3 text-body"
          />
          {state.errors?.identifier && (
            <p className="mt-1 text-caption text-negative">{state.errors.identifier[0]}</p>
          )}
        </div>

        <PasswordInput
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          error={state.errors?.password?.[0]}
        />

        <div className="text-right">
          <Link href="/forgot-password" className="text-caption text-accent-strong hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {state.errors?._form && <p className="text-caption text-negative">{state.errors._form[0]}</p>}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-sm bg-accent-strong text-body font-medium text-white disabled:opacity-50"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-caption text-text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-accent-strong hover:underline">
          Regístrate
        </Link>
      </p>
    </>
  );
}
