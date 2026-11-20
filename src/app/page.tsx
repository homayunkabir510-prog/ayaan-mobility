import Link from "next/link";
import { ArrowRight, ClipboardCheck, Shield, Truck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Ayaan Mobility</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">Fleet operations, with the details in one place.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">A role-based workspace for drivers, fleet teams, corporate clients, and vehicle owners to record work and review the same operational facts.</p>
        <div className="mt-8"><Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2">Sign in <ArrowRight className="h-5 w-5" /></Link></div>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><Truck className="h-6 w-6 text-emerald-700" /><h2 className="mt-4 font-semibold">Fleet visibility</h2><p className="mt-2 text-sm leading-6 text-slate-600">See vehicles and duty activity within your role and company scope.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><ClipboardCheck className="h-6 w-6 text-emerald-700" /><h2 className="mt-4 font-semibold">Evidence-led duty records</h2><p className="mt-2 text-sm leading-6 text-slate-600">Submit odometer readings and private evidence for authorized review.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><Shield className="h-6 w-6 text-emerald-700" /><h2 className="mt-4 font-semibold">Controlled access</h2><p className="mt-2 text-sm leading-6 text-slate-600">Protected portals re-check account status and role on the server.</p></div>
      </div>
    </main>
  );
}
