"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap } from "lucide-react";

function slugToBusinessName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function RegisterForm({ initialSlug }: { initialSlug: string }) {
  const [businessName, setBusinessName] = useState(
    initialSlug ? slugToBusinessName(initialSlug) : ""
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Create the tenant + profile via server-side API route (uses service role)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Registration failed.");
      setLoading(false);
      return;
    }

    // Sign in with the newly created credentials
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const base = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (base && base !== "localhost") {
      window.location.href = `https://${data.slug}.${base}/app/dashboard`;
    } else {
      window.location.href = `http://localhost:3000/app/dashboard`;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <span className="text-sm font-semibold">BillableDesk</span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Set up your consulting workspace.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Mac Willingham Consulting"
            />
            {initialSlug && (
              <p className="text-xs text-muted-foreground">
                Your workspace URL will be based on your business name.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
