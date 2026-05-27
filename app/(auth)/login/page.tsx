"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth, useSignIn } from "@/lib/auth-store";
import { toast } from "@/lib/toast-store";
import { AuthArtPanel } from "@/components/auth/AuthArtPanel";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const { user, hydrated } = useAuth();
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && user && !user.isGuest) router.replace(next);
  }, [hydrated, user, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't sign in.");
      return;
    }
    toast({ title: "Welcome back!", body: "Time to defend that streak.", tone: "success" });
    router.replace(next);
  }

  return (
    <>
      <AuthArtPanel kicker="Sign in" title="Welcome back. They've been talking." />
      <section className="flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden inline-flex items-center gap-2 px-3 py-1 border-2 border-black bg-bone-50 rounded-full text-xs font-bold uppercase tracking-widest text-black mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-magenta" />
            Sign in
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-bone-50">
            Drop back <span className="text-lemon">in.</span>
          </h1>
          <p className="mt-3 text-sm text-bone-200/70 font-semibold">
            Sign in to defend your rank, queue up matches, and unlock new mini games.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@arena15.gg"
            />
            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              error={error ?? undefined}
            />

            <Button type="submit" size="lg" full loading={loading}>
              {loading ? "Loading…" : "Drop in"}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-bone-200/15" />
            <span className="text-xs uppercase tracking-widest text-bone-200/50 font-bold">or</span>
            <div className="h-px flex-1 bg-bone-200/15" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => toast({ title: "OAuth not wired yet", body: "Add an OAuth provider via Convex Auth to enable.", tone: "warning" })}
            >
              GitHub
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => toast({ title: "OAuth not wired yet", body: "Add an OAuth provider via Convex Auth to enable.", tone: "warning" })}
            >
              Discord
            </Button>
          </div>

          <p className="mt-8 text-sm text-bone-200/70">
            New to the Arena?{" "}
            <Link href="/signup" className="text-lemon font-bold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <LoginForm />
    </Suspense>
  );
}
