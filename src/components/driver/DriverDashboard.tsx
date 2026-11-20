import Link from "next/link";
import { Clock, History, MapPin, Wallet } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatter";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";

export interface DriverDashboardProps {
  driverName: string;
  totalKmToday: number;
  approvedAmountToday: number;
  pendingReviewCount: number;
  dutyInProgress?: {
    id: string;
    startTime: Date;
    startOdometer: number;
    startLocation?: string | null;
  };
}

export default function DriverDashboard({
  driverName,
  totalKmToday,
  approvedAmountToday,
  pendingReviewCount,
  dutyInProgress,
}: DriverDashboardProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 p-6 text-white">
        <p className="text-sm opacity-90">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold">{driverName}</h1>
        <p className="mt-2 text-sm opacity-90">{formatDate(new Date())}</p>
      </div>

      {dutyInProgress ? (
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardHeader><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-emerald-950">Duty in progress</h2><Badge variant="pending">Active</Badge></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded bg-white/70 p-3"><p className="text-xs text-slate-600">Started</p><p className="text-sm font-bold text-slate-900">{formatDateTime(dutyInProgress.startTime)}</p></div>
              <div className="rounded bg-white/70 p-3"><p className="text-xs text-slate-600">Start odometer</p><p className="text-lg font-bold text-slate-900">{dutyInProgress.startOdometer} km</p></div>
            </div>
            {dutyInProgress.startLocation && <div className="flex items-center gap-2 text-slate-700"><MapPin className="h-4 w-4" /><p className="text-sm">{dutyInProgress.startLocation}</p></div>}
            <p className="text-sm text-slate-700">Finish the duty form below when the trip is complete.</p>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="pt-6 text-center"><p className="font-medium text-slate-800">No active duty</p><p className="mt-1 text-sm text-slate-600">Start a duty after confirming your assigned vehicle.</p></CardContent></Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-slate-600"><MapPin className="h-4 w-4" /><p className="text-xs">Distance submitted today</p></div><p className="mt-2 text-2xl font-bold text-slate-950">{totalKmToday.toFixed(1)} km</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-slate-600"><Wallet className="h-4 w-4" /><p className="text-xs">Approved amount today</p></div><p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(approvedAmountToday)}</p></CardContent></Card>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-medium text-amber-950">Duties awaiting review</p><span className="font-bold text-amber-900">{pendingReviewCount}</span></div>
      <Link href="#history" className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"><History className="h-4 w-4" /> View duty history <Clock className="ml-auto h-4 w-4" /></Link>
    </div>
  );
}
