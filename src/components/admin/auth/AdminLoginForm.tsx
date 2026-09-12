"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm({ expired }: { expired: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = await fetch("/api/admin-session/login", {
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Login failed.");
      router.replace("/admin");
    } catch {
      setError("El correo o la contraseña no son válidos.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">EntrenAR</p>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950">Acceso administrativo</h1>
        {expired ? <p className="mt-3 text-sm text-zinc-600">Tu sesión administrativa expiró. Ingresá nuevamente.</p> : null}
        <div className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-zinc-800">Correo<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-xl border border-zinc-300 px-3" /></label>
          <label className="grid gap-2 text-sm font-semibold text-zinc-800">Contraseña<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl border border-zinc-300 px-3" /></label>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="h-11 rounded-xl bg-zinc-950 font-semibold text-white">Ingresar</button>
        </div>
      </form>
    </main>
  );
}
