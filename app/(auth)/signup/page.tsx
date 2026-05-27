"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth, useSignUp } from "@/lib/auth-store";
import { toast } from "@/lib/toast-store";
import { AuthArtPanel } from "@/components/auth/AuthArtPanel";

export default function SignUpPage() {
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const signUp = useSignUp();
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && user && !user.isGuest) router.replace("/");
  }, [hydrated, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signUp(handle.trim(), email.trim(), password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't create account.");
      return;
    }
    toast({ title: "Welcome to the arena!", body: `Locked in as @${handle}.`, tone: "success" });
    router.replace("/");
  }

  return (
    <>
      <AuthArtPanel kicker="Create account" title="Pick a name. Make it loud." />
      <section className="flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden inline-flex items-center gap-2 px-3 py-1 border-2 border-black bg-bone-50 rounded-full text-xs font-bold uppercase tracking-widest text-black mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-magenta" />
            Create account
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-bone-50">
            Get in <span className="text-magenta">loser,</span> we're playing.
          </h1>
          <p className="mt-3 text-sm text-bone-200/70 font-semibold">
            Pick a handle. We'll mint you an avatar and you can start a match in under 30 seconds.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Input
              label="Handle"
              name="handle"
              autoComplete="username"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="kiloflame"
              leading={<span className="font-bold">@</span>}
              hint="3+ characters. Letters, numbers, and underscores."
            />
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6+ characters"
              error={error ?? undefined}
            />

            <Button type="submit" variant="magenta" size="lg" full loading={loading}>
              {loading ? "Spinning up…" : "Create account"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-bone-200/70">
            Already in?{" "}
            <Link href="/login" className="text-lemon font-bold hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-4 text-xs text-bone-200/40">
            You're already playing as a guest. Signing up promotes your guest profile into a permanent account.
          </p>
        </div>
      </section>
    </>
  );
}
