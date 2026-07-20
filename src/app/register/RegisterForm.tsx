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
    <>
      <div className="mb-5 text-center">
        <h2 className="text-heading font-medium">Crea tu cuenta</h2>
        <p className="mt-0.5 text-caption text-text-muted">Empecemos con tus datos básicos.</p>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="mb-1 block text-caption text-text-muted" htmlFor="username">
            Nombre de usuario
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            pattern="[A-Za-z0-9_]{3,30}"
            title="3-30 caracteres, sin espacios ni acentos (mayúsculas y minúsculas se tratan igual)"
            autoComplete="username"
            className="h-11 w-full rounded-sm border border-border bg-transparent px-3 text-body"
          />
          <p className="mt-1 text-caption text-text-muted">Será tu nombre visible en Perfin.</p>
          {state.errors?.username && (
            <p className="mt-1 text-caption text-negative">{state.errors.username[0]}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-caption text-text-muted" htmlFor="email">
            Correo electrónico <span className="text-text-muted">(opcional)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@correo.com"
            className="h-11 w-full rounded-sm border border-border bg-transparent px-3 text-body"
          />
          <p className="mt-1 text-caption text-text-muted">
            Sin correo no podrás recuperar tu contraseña si la olvidas.
          </p>
          {state.errors?.email && <p className="mt-1 text-caption text-negative">{state.errors.email[0]}</p>}
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

        {state.errors?._form && <p className="text-caption text-negative">{state.errors._form[0]}</p>}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-sm bg-accent-strong text-body font-medium text-white disabled:opacity-50"
        >
          {pending ? "Creando cuenta…" : "Continuar"}
        </button>

        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center rounded-sm text-body font-medium text-accent-strong"
        >
          Ya tengo cuenta
        </Link>
      </form>
    </>
  );
}
