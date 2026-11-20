import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import { formatDate, formatCurrency, formatDuration } from "@/lib/formatter";
import type { DutyLog } from "@/generated/prisma/client";
import { MapPin, Clock, Zap } from "lucide-react";

export interface DutyLogCardProps {
  dutyLog: DutyLog;
}

const statusConfig: Record<DutyLog["status"], { variant: "approved" | "pending" | "rejected"; label: string }> = {
  APPROVED: { variant: "approved", label: "Approved" },
  PENDING_APPROVAL: { variant: "pending", label: "Pending review" },
  REJECTED: { variant: "rejected", label: "Rejected" },
  EDITED_BY_ADMIN: { variant: "approved", label: "Edited by admin" },
};

export default function DutyLogCard({ dutyLog }: DutyLogCardProps) {
  const config = statusConfig[dutyLog.status];
  const reviewed = dutyLog.status === "APPROVED" || dutyLog.status === "EDITED_BY_ADMIN";

  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">{formatDate(dutyLog.date)}</p><p className="text-sm font-semibold text-slate-900">Duty #{dutyLog.id.slice(0, 8)}</p></div><Badge variant={config.variant}>{config.label}</Badge></div></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-slate-400" /><div><p className="text-xs text-slate-500">Distance</p><p className="font-semibold text-slate-900">{dutyLog.totalKm.toFixed(1)} km</p></div></div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /><div><p className="text-xs text-slate-500">Duration</p><p className="font-semibold text-slate-900">{formatDuration(dutyLog.dutyHours)}</p></div></div>
        </div>
        {dutyLog.endLocation && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><p className="text-sm text-slate-600">{dutyLog.endLocation}</p></div>}
        <div className="border-t border-slate-200 pt-3"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-600">{reviewed ? "Approved total" : "Submitted total"}</p><p className={`text-lg font-bold ${reviewed ? "text-emerald-700" : "text-slate-800"}`}>{formatCurrency(Number(dutyLog.totalDailyBill))}</p></div>{!reviewed && <p className="mt-1 text-xs text-slate-500">This amount is not approved for billing yet.</p>}</div>
      </CardContent>
    </Card>
  );
}
