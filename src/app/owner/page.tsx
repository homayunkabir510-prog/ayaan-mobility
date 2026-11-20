import { prisma } from "@/lib/prisma";
import { requirePortalUser } from "@/lib/page-auth";
import PortalHeader from "@/components/shared/PortalHeader";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "approved" | "pending" | "rejected"> = {
  ACTIVE: "approved",
  IN_DUTY: "pending",
  MAINTENANCE: "rejected",
  INACTIVE: "rejected",
};

export default async function OwnerPortalPage() {
  const user = await requirePortalUser(["CAR_OWNER"]);
  if (!user.carOwnerProfileId) return <main className="mx-auto max-w-4xl p-4"><PortalHeader title="Vehicle owner portal" userName={user.name} /><p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">This owner account is not linked to a vehicle-owner profile. Ask an administrator to correct the account.</p></main>;

  const [owner, vehicles] = await Promise.all([
    prisma.carOwnerProfile.findUnique({ where: { id: user.carOwnerProfileId }, select: { user: { select: { name: true } } } }),
    prisma.vehicle.findMany({
      where: { carOwnerId: user.carOwnerProfileId },
      orderBy: { regNumber: "asc" },
      include: { currentDriver: { include: { user: { select: { name: true } } } } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader title="Vehicle owner portal" userName={user.name} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div><h2 className="text-2xl font-bold text-slate-950">Welcome, {owner?.user.name ?? user.name}</h2><p className="mt-1 text-sm text-slate-600">Only vehicles linked to your owner profile are shown.</p></div>
        <section className="space-y-4"><h3 className="text-xl font-bold text-slate-950">Your vehicles</h3>{vehicles.length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-600">No vehicles are linked to this profile yet.</CardContent></Card> : vehicles.map((vehicle) => <Card key={vehicle.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-lg font-bold text-slate-950">{vehicle.regNumber}</h4><p className="text-sm text-slate-600">{vehicle.category.replaceAll("_", " ")} · {vehicle.modelYear}</p></div><Badge variant={statusVariant[vehicle.status]}>{vehicle.status.replaceAll("_", " ")}</Badge></div></CardHeader><CardContent><p className="text-sm text-slate-700">{vehicle.currentDriver ? `Assigned driver: ${vehicle.currentDriver.user.name}` : "No driver currently assigned"}</p></CardContent></Card>)}</section>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-900">Settlements</h3><p className="mt-1 text-sm text-slate-600">Owner payout calculation and settlement actions are not yet available. This portal does not display estimated or unverified balances.</p></div>
      </main>
    </div>
  );
}
