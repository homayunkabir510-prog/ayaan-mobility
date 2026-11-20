import { prisma } from "@/lib/prisma";
import { requirePortalUser } from "@/lib/page-auth";
import PortalHeader from "@/components/shared/PortalHeader";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import EvidenceLink from "@/components/shared/EvidenceLink";
import AdminDecisionButtons from "@/components/admin/AdminDecisionButtons";
import ClaimDecisionButtons from "@/components/admin/ClaimDecisionButtons";
import { formatCurrency, formatDateTime } from "@/lib/formatter";

export const dynamic = "force-dynamic";

export default async function AdminPortalPage() {
  const user = await requirePortalUser(["SUPER_ADMIN", "OPERATIONS_ADMIN", "ACCOUNTS_ADMIN"]);
  const [pendingCount, completedCount, vehicleCount, pendingDuties] = await Promise.all([
    prisma.dutyLog.count({ where: { status: "PENDING_APPROVAL", endTime: { not: null } } }),
    prisma.dutyLog.count({ where: { endTime: { not: null } } }),
    prisma.vehicle.count(),
    prisma.dutyLog.findMany({
      where: { status: "PENDING_APPROVAL", endTime: { not: null } },
      orderBy: { endTime: "asc" },
      take: 40,
      include: {
        driver: { include: { user: { select: { name: true, phone: true } } } },
        vehicle: { select: { regNumber: true } },
        company: { select: { name: true } },
        expenseClaims: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader title="Operations review" userName={user.name} links={[{ label: "Review queue", href: "#review-queue" }]} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="pt-5"><p className="text-sm text-slate-600">Duties awaiting review</p><p className="mt-2 text-3xl font-bold text-amber-700">{pendingCount}</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-slate-600">Completed duty records</p><p className="mt-2 text-3xl font-bold text-slate-950">{completedCount}</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-slate-600">Vehicles</p><p className="mt-2 text-3xl font-bold text-slate-950">{vehicleCount}</p></CardContent></Card>
        </section>

        <section id="review-queue" className="scroll-mt-6 space-y-4">
          <div><h2 className="text-xl font-bold text-slate-950">Duty review queue</h2><p className="mt-1 text-sm text-slate-600">Resolve pending expense claims first; then review odometer evidence and decide the duty.</p></div>
          {pendingDuties.length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-600">No completed duties are waiting for review.</CardContent></Card> : pendingDuties.map((duty) => (
            <Card key={duty.id}>
              <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-950">{duty.vehicle.regNumber} · {duty.driver.user.name}</h3><p className="mt-1 text-sm text-slate-600">{duty.company.name} · {formatDateTime(duty.startTime)} to {duty.endTime ? formatDateTime(duty.endTime) : "Open"}</p></div><Badge variant="pending">Pending review</Badge></div></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Distance</p><p className="font-semibold">{duty.totalKm.toFixed(1)} km</p></div><div><p className="text-xs text-slate-500">Overtime</p><p className="font-semibold">{duty.overtimeHours.toFixed(1)} hours</p></div><div><p className="text-xs text-slate-500">Submitted amount</p><p className="font-semibold">{formatCurrency(duty.totalDailyBill.toNumber())}</p></div></div>
                <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><h4 className="text-sm font-semibold">Odometer evidence</h4><EvidenceLink path={duty.startOdometerImg} label="View start photo" /><EvidenceLink path={duty.endOdometerImg} label="View end photo" /></div><div><h4 className="text-sm font-semibold">Driver route notes</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{duty.routeNotes || "No route notes provided."}</p></div></div>
                {duty.adminEditNote && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Review flags / correction note</p><p className="mt-1 text-sm text-amber-950">{duty.adminEditNote}</p></div>}
                {duty.expenseClaims.length > 0 && <div className="space-y-3 border-t border-slate-200 pt-4"><h4 className="font-semibold text-slate-900">Pending expense claims</h4>{duty.expenseClaims.map((claim) => <div key={claim.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2"><div><p className="font-medium">{claim.expenseType} · {formatCurrency(claim.amount.toNumber())}</p><div className="mt-2"><EvidenceLink path={claim.receiptImg} label="View receipt" /></div></div><ClaimDecisionButtons claimId={claim.id} /></div>)}</div>}
                <AdminDecisionButtons dutyLogId={duty.id} blocked={duty.expenseClaims.length > 0} />
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
