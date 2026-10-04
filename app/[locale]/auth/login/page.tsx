"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type HealthReport = {
  ok: boolean;
  projectRef: string | null;
  checks: Record<string, { ok: boolean; detail: string }>;
  remedy: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);

  // Probe the backend before the user types anything. Without this, an
  // unreachable Supabase project only fails once they submit, and the failure
  // surfaces as an opaque "Failed to fetch" in the console.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/health/supabase", { cache: "no-store" })
      .then((res) => res.json())
      .then((report: HealthReport) => {
        if (!cancelled) setHealth(report);
      })
      .catch(() => {
        // The diagnostic endpoint being unreachable is itself the signal.
        if (!cancelled) {
          setHealth({
            ok: false,
            projectRef: null,
            checks: {},
            remedy: "Could not reach the server. Is the dev server still running?",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    if (health && !health.ok) {
      setError(
        health.remedy ??
          "The authentication service is not reachable. Check the server logs.",
      );
      return;
    }

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const role = data.user?.app_metadata?.role as string | undefined;
      if (role === "head_office_admin") router.push("/admin");
      else if (role === "branch_manager") router.push("/manager");
      else router.push("/teller");
      router.refresh();
    } catch (caught) {
      // Network-level failures (DNS, TLS, offline) reject rather than resolve
      // with an `error`, so they must be caught here or the form goes dead.
      console.error("Sign-in failed:", caught);
      setError(
        "Could not reach the authentication service. This is a network or server " +
          "configuration problem rather than a bad email or password.",
      );
    }
  }

  const unhealthy = health !== null && !health.ok;

  return (
    <div className="flex flex-col gap-4">
      {unhealthy && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-xs text-amber-200">
          <p className="font-semibold">
            Backend not ready{health.projectRef ? ` — project "${health.projectRef}"` : ""}
          </p>
          {Object.entries(health.checks)
            .filter(([, check]) => !check.ok)
            .map(([name, check]) => (
              <p key={name} className="mt-1">
                <span className="opacity-70">{name}:</span> {check.detail}
              </p>
            ))}
          {health.remedy && <p className="mt-2 leading-relaxed">{health.remedy}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h1 className="text-xl font-bold text-white text-center">Sign in</h1>
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-500"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-500"
        />
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <button
          type="submit"
          disabled={unhealthy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}