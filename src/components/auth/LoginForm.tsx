"use client";

import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import Alert from "@/components/shared/Alert";
import Spinner from "@/components/shared/Spinner";
import type { Role } from "@/generated/prisma/client";

const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  OPERATIONS_ADMIN: "/admin",
  ACCOUNTS_ADMIN: "/admin",
  CLIENT_USER: "/fleet",
  DRIVER: "/go",
  CAR_OWNER: "/owner",
};

function safeInternalDestination(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const target = new URL(value, window.location.origin);
    return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}

export default function LoginForm({ next }: { next?: string }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await loginAction({ phone: phone.trim(), password });
      if (!response.success) {
        setError(response.error);
        return;
      }
      const destination = safeInternalDestination(next) ?? ROLE_HOME[response.data.role];
      window.location.assign(destination);
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert variant="error" title="Sign-in failed">{error}</Alert>}
      <Input label="Phone number" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={32} />
      <Input label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} />
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? <><Spinner size="sm" /> Signing in…</> : <>Continue <ArrowRight className="h-4 w-4" /></>}
      </Button>
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Secure role-based access</div>
    </form>
  );
}

export function LoginVisual() {
  return (
    <div className="hidden overflow-hidden rounded-[2rem] bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div>
        <div className="mb-12 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 font-black">AM</span><span className="font-semibold">Ayaan Mobility</span></div>
        <p className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Every kilometre accounted for. Every team moving together.</p>
        <p className="mt-5 max-w-md text-slate-300">A single operating layer for duty logs, approvals, fleet visibility, and driver expenses.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {["Live duty visibility", "Role-aware approvals", "Audit-ready records"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>{item}</div>)}
      </div>
    </div>
  );
}
