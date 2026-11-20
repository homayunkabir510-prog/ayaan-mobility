import { prisma } from "@/lib/prisma";
import { requirePortalUser } from "@/lib/page-auth";
import PortalHeader from "@/components/shared/PortalHeader";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import { formatCurrency, formatDateTime } from "@/lib/formatter";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "approved" | "pending" | "rejected" }> = {
  APPROVED: { label: "Approved", variant: "approved" },
  EDITED_BY_ADMIN: { label: "Edited by admin", variant: "approved" },
  PENDING_APPROVAL: { label: "Pending review", variant: "pending" },
  REJECTED: { label: "Rejected", variant: "rejected" },
};

export default async function FleetClientPortalPage() {
  const user = await requirePortalUser(["CLIENT_USER"]);
  if (!user.companyId) return <main className="mx-auto max-w-4xl p-4"><PortalHeader title="Client fleet portal" userName={user.name} /><p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">This client account is not linked to a company. Ask an administrator to correct the account.</p></main>;

  const [company, duties] = await Promise.all([
    prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } }),
    prisma.dutyLog.findMany({
      where: { companyId: user.companyId, endTime: { not: null } },
      orderBy: { startTime: "desc" },
      take: 40,
      include: { driver: { include: { user: { select: { name: true } } } }, vehicle: { select: { regNumber: true } } },
    }),
  ]);
  const approved = duties.filter((duty) => duty.status === "APPROVED" || duty.status === "EDITED_BY_ADMIN");
  const approvedTotal = approved.reduce((sum, duty) => sum + duty.totalDailyBill.toNumber(), 0);
  const pending = duties.filter((duty) => duty.status === "PENDING_APPROVAL").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader title="Client fleet portal" userName={user.name} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div><h2 className="text-2xl font-bold text-slate-950">{company?.name ?? "Company"}</h2><p className="mt-1 text-sm text-slate-600">Duty records are filtered to your company account.</p></div>
        <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="pt-5"><p className="text-sm text-slate-600">Completed duties shown</p><p className="mt-2 text-3xl font-bold">{duties.length}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-sm text-slate-600">Awaiting review</p><p className="mt-2 text-3xl font-bold text-amber-700">{pending}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-sm text-slate-600">Approved total shown</p><p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(approvedTotal)}</p></CardContent></Card></div>
        <section className="space-y-4"><h3 className="text-xl font-bold text-slate-950">Recent duties</h3>{duties.length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-600">No completed duty records are available.</CardContent></Card> : duties.map((duty) => { const status = STATUS[duty.status]; const approvedDuty = duty.status === "APPROVED" || duty.status === "EDITED_BY_ADMIN"; return <Card key={duty.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-slate-950">{duty.vehicle.regNumber} · {duty.driver.user.name}</h4><p className="mt-1 text-sm text-slate-600">{formatDateTime(duty.startTime)}{duty.endTime ? ` – ${formatDateTime(duty.endTime)}` : ""}</p></div><Badge variant={status.variant}>{status.label}</Badge></div></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-600">Distance: {duty.totalKm.toFixed(1)} km</p><p className="text-xs text-slate-500">{approvedDuty ? "Approved billable amount" : "Submitted amount; not yet approved"}</p></div><p className={`text-lg font-bold ${approvedDuty ? "text-emerald-700" : "text-slate-700"}`}>{formatCurrency(duty.totalDailyBill.toNumber())}</p></CardContent></Card>; })}</section>
      </main>
    </div>
  );
}
