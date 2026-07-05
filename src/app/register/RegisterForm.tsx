"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";

interface FormState {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
}

async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get("email");
  return signUpAction({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    email: email ? email : undefined,
    password: formData.get("password"),
  });
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(submit, {});

  return (
    <form action={action} className="space-y-4 rounded-lg border p-6">
      <div>
        <label className="block text-sm font-medium">Usuario</label>
        <input
          name="username"
          type="text"
          required
          pattern="[A-Za-z0-9_]{3,30}"
          title="3-30 caracteres, sin espacios ni acentos (mayúsculas y minúsculas se tratan igual)"
          autoComplete="username"
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.username && (
          <p className="text-red-600 text-xs mt-1">{state.errors.username[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Nombre para mostrar</label>
        <input
          name="displayName"
          type="text"
          required
          maxLength={100}
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.displayName && (
          <p className="text-red-600 text-xs mt-1">{state.errors.displayName[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">
          Correo <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
        />
        {state.errors?.email && (
          <p className="text-red-600 text-xs mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
