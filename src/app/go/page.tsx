import { prisma } from "@/lib/prisma";
import { requirePortalUser } from "@/lib/page-auth";
import { dhakaCalendarDate } from "@/lib/actions/shared";
import PortalHeader from "@/components/shared/PortalHeader";
import DriverDashboard from "@/components/driver/DriverDashboard";
import DutyEndForm from "@/components/driver/DutyEndForm";
import StartDutyForm from "@/components/driver/StartDutyForm";
import ExpenseClaimForm, { type ExpenseClaim } from "@/components/driver/ExpenseClaimForm";
import DutyLogCard from "@/components/driver/DutyLogCard";
import Card, { CardContent } from "@/components/shared/Card";
import Alert from "@/components/shared/Alert";

export const dynamic = "force-dynamic";

function dhakaDayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(`${dhakaCalendarDate(now)}T00:00:00+06:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function expenseType(value: string): ExpenseClaim["expenseType"] {
  return value === "TOLL" || value === "PARKING" ? value : "OTHER";
}

export default async function DriverPortalPage() {
  const user = await requirePortalUser(["DRIVER"]);
  if (!user.driverProfileId) {
    return <main className="mx-auto max-w-3xl p-4"><PortalHeader title="Driver portal" userName={user.name} /><Alert variant="error" title="Driver profile not linked">Ask an administrator to link a driver profile to this account.</Alert></main>;
  }

  const { start, end } = dhakaDayRange(new Date());
  const [profile, activeDuty, recentDuties, todayDuties, pendingReviewCount] = await Promise.all([
    prisma.driverProfile.findUnique({ where: { id: user.driverProfileId }, include: { assignedVehicle: true } }),
    prisma.dutyLog.findFirst({
      where: { driverId: user.driverProfileId, endTime: null },
      include: { expenseClaims: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.dutyLog.findMany({ where: { driverId: user.driverProfileId }, orderBy: { startTime: "desc" }, take: 8 }),
    prisma.dutyLog.findMany({ where: { driverId: user.driverProfileId, startTime: { gte: start, lt: end }, endTime: { not: null } } }),
    prisma.dutyLog.count({ where: { driverId: user.driverProfileId, status: "PENDING_APPROVAL", endTime: { not: null } } }),
  ]);

  const totalKmToday = todayDuties.reduce((sum, duty) => sum + duty.totalKm, 0);
  const approvedAmountToday = todayDuties
    .filter((duty) => duty.status === "APPROVED" || duty.status === "EDITED_BY_ADMIN")
    .reduce((sum, duty) => sum + duty.totalDailyBill.toNumber(), 0);
  const existingClaims: ExpenseClaim[] = (activeDuty?.expenseClaims ?? []).map((claim) => ({
    id: claim.id,
    expenseType: expenseType(claim.expenseType),
    amount: claim.amount.toNumber(),
    status: claim.status,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader title="Driver portal" userName={user.name} links={[{ label: "Overview", href: "/go" }, { label: "History", href: "#history" }, { label: "Expenses", href: "#expenses" }]} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <DriverDashboard
          driverName={user.name}
          totalKmToday={totalKmToday}
          approvedAmountToday={approvedAmountToday}
          pendingReviewCount={pendingReviewCount}
          dutyInProgress={activeDuty ? {
            id: activeDuty.id,
            startTime: activeDuty.startTime,
            startOdometer: activeDuty.startOdometer,
            startLocation: activeDuty.startLocation,
          } : undefined}
        />

        {activeDuty ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <DutyEndForm dutyLogId={activeDuty.id} startOdometer={activeDuty.startOdometer} startTime={activeDuty.startTime} driverName={user.name} />
            <ExpenseClaimForm dutyLogId={activeDuty.id} existingClaims={existingClaims} />
          </div>
        ) : profile?.assignedVehicle?.status === "ACTIVE" ? (
          <StartDutyForm vehicleId={profile.assignedVehicle.id} />
        ) : (
          <Card><CardContent className="pt-6"><h2 className="font-semibold text-slate-900">No vehicle available to start</h2><p className="mt-1 text-sm text-slate-600">A vehicle must be assigned to you and marked active before you can start a duty.</p></CardContent></Card>
        )}

        <section id="history" className="scroll-mt-6 space-y-4">
          <div><h2 className="text-xl font-bold text-slate-950">Recent duty history</h2><p className="mt-1 text-sm text-slate-600">Amounts awaiting review are shown as submitted, not approved.</p></div>
          {recentDuties.length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-600">No duty records yet.</CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{recentDuties.map((duty) => <DutyLogCard key={duty.id} dutyLog={duty} />)}</div>}
        </section>
      </main>
    </div>
  );
}
