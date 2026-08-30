import { ReactNode } from "react";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import { formatDate, formatCurrency, formatDuration } from "@/lib/formatter";
import type { DutyLog } from "@prisma/client";
import { Calendar, MapPin, Clock, Zap } from "lucide-react";

export interface DutyLogCardProps {
  dutyLog: DutyLog;
  onClick?: () => void;
}

const statusConfig: Record<string, { variant: "approved" | "pending" | "rejected"; label: string }> = {
  APPROVED: { variant: "approved", label: "✓ Approved" },
  PENDING_APPROVAL: { variant: "pending", label: "⏳ Pending" },
  REJECTED: { variant: "rejected", label: "✗ Rejected" },
  EDITED_BY_ADMIN: { variant: "approved", label: "📝 Edited" },
};

const DutyLogCard = ({ dutyLog, onClick }: DutyLogCardProps) => {
  const config = statusConfig[dutyLog.status];

  return (
    <Card onClick={onClick} className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{formatDate(dutyLog.date)}</p>
            <p className="text-sm font-semibold text-gray-900">Duty #{dutyLog.id.slice(0, 8)}</p>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Distance</p>
              <p className="font-semibold text-gray-900">{dutyLog.totalKm} km</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="font-semibold text-gray-900">{formatDuration(dutyLog.dutyHours)}</p>
            </div>
          </div>
        </div>

        {dutyLog.endLocation && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <p className="text-sm text-gray-600">{dutyLog.endLocation}</p>
          </div>
        )}

        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Total Bill</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(dutyLog.totalDailyBill)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DutyLogCard;
