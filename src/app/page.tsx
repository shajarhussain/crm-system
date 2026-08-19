"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { IS_DEMO, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo/store";
import { ShieldCheck, ArrowRight, Lock, Mail, AlertCircle, Info } from "lucide-react";

/** Firebase auth error codes mapped to something a user can act on. */
function describeSignInError(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password combination is not recognised.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Cannot reach the server. Check your connection.";

    // Project configuration problems rather than user error. These surface on a
    // Firebase project where the Email/Password provider was never switched on —
    // easy to miss, because nothing else in the app exercises sign-in.
    case "auth/configuration-not-found":
    case "auth/operation-not-allowed":
      return "Email and password sign-in is not enabled on this Firebase project. Enable it under Authentication → Sign-in method.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "The Firebase API key is missing or wrong. Check NEXT_PUBLIC_FIREBASE_API_KEY.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised for sign-in. Add it under Authentication → Settings → Authorized domains.";
    default:
      return "Could not sign you in. Please try again.";
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user, role, loading, roleError, signIn } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    if (role === "admin") router.replace("/admin");
    else if (role === "employee") router.replace("/employee");
  }, [user, role, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "unknown";
      // Log the raw code — the friendly message deliberately hides which of
      // "no such account" and "wrong password" it was, but that distinction
      // matters when you are the one setting the project up.
      console.error("[auth] Sign-in failed:", code, err);
      setError(describeSignInError(code));
      setErrorCode(code);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 text-slate-100">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative w-full max-w-md space-y-7 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="space-y-2 text-center">
          <div className="mb-1 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/25">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">CRM System</h1>
          <p className="text-xs text-slate-400">Lead Management &amp; Distribution Platform</p>
        </div>

        {roleError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-medium text-amber-300">
            <AlertCircle size={16} className="mt-px shrink-0" />
            <span>{roleError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-800/60 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-800/60 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="space-y-1 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-400">
              <p>{error}</p>
              {process.env.NODE_ENV !== "production" && errorCode && (
                <p className="font-mono text-[11px] text-red-400/60">{errorCode}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        {IS_DEMO ? (
          <div className="space-y-2 border-t border-slate-800/80 pt-4">
            <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <Info size={12} /> Demo accounts
            </p>
            <div className="space-y-1">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.uid}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-left text-[11px] transition-colors hover:border-slate-700 hover:bg-slate-800"
                >
                  <span className="font-semibold text-slate-200">{account.email}</span>
                  <span className="capitalize text-slate-500">{account.role}</span>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-slate-500">
              Password for all: <span className="font-mono text-slate-400">{DEMO_PASSWORD}</span>
            </p>
          </div>
        ) : (
          <p className="border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
            Accounts are created by your administrator.
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        {IS_DEMO
          ? "Demonstration build — sample data only, nothing is saved"
          : "Role-based access enforced by Firestore Security Rules"}
      </p>
    </div>
  );
}
