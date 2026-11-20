"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import Button from "@/components/shared/Button";

export default function PortalHeader({ title, userName, links = [] }: { title: string; userName: string; links?: Array<{ label: string; href: string }> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    setLoading(true);
    setError(null);
    const response = await logoutAction();
    setLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Ayaan Mobility</p><h1 className="text-xl font-bold text-slate-950">{title}</h1></div>
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Portal" className="flex flex-wrap gap-3 text-sm">{links.map((link) => <a key={link.href} href={link.href} className="font-medium text-slate-600 hover:text-emerald-700">{link.label}</a>)}</nav>
          <span className="text-sm text-slate-600">{userName}</span>
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={signOut}>{loading ? "Signing out…" : "Sign out"}</Button>
        </div>
        {error && <p role="alert" className="w-full text-right text-xs text-rose-700">{error}</p>}
      </div>
    </header>
  );
}
