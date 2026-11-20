import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm, { LoginVisual } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

type LoginPageProps = { searchParams: Promise<{ next?: string | string[] }> };

const ROLE_HOME = {
  SUPER_ADMIN: "/admin",
  OPERATIONS_ADMIN: "/admin",
  ACCOUNTS_ADMIN: "/admin",
  CLIENT_USER: "/fleet",
  DRIVER: "/go",
  CAR_OWNER: "/owner",
} as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-2 lg:items-stretch lg:px-8">
      <LoginVisual />
      <section className="flex flex-col justify-center rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8 lg:hidden"><p className="text-sm font-semibold text-emerald-700">AYAAN MOBILITY</p></div>
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Welcome back</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Sign in to your portal</h1>
        <p className="mt-2 mb-8 text-sm text-slate-600">Use the phone number and password linked to your Ayaan account.</p>
        <LoginForm next={next} />
      </section>
    </main>
  );
}
