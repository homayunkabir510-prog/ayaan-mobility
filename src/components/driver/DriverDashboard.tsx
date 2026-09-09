"use client";

import { formatCurrency, formatDate } from "@/lib/formatter";
import Button from "@/components/shared/Button";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import { LogOut, MapPin, Zap } from "lucide-react";

export interface DriverDashboardProps {
  driverName: string;
  totalKmToday: number;
  totalEarnedToday: number;
  dutyInProgress?: {
    id: string;
    startTime: Date;
    startOdometer: number;
    startLocation?: string;
  };
  onStartDuty?: () => void;
  onEndDuty?: () => void;
}

const DriverDashboard = ({
  driverName,
  totalKmToday,
  totalEarnedToday,
  dutyInProgress,
  onStartDuty,
  onEndDuty,
}: DriverDashboardProps) => {
  const currentTime = new Date();
  const dutyStartTime = dutyInProgress ? new Date(dutyInProgress.startTime) : null;
  const dutyHours = dutyStartTime
    ? (currentTime.getTime() - dutyStartTime.getTime()) / (1000 * 60 * 60)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-lg">
        <p className="text-sm opacity-90">Welcome back</p>
        <h1 className="text-3xl font-bold">{driverName}</h1>
        <p className="text-sm opacity-90 mt-1">{formatDate(new Date())}</p>
      </div>

      {/* Active Duty */}
      {dutyInProgress ? (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-green-900">Duty In Progress</h2>
              <Badge variant="pending">🚗 Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded bg-white/70 p-3">
                <p className="text-xs text-gray-600">Duration</p>
                <p className="text-lg font-bold text-gray-900">{dutyHours.toFixed(1)} hours</p>
              </div>
              <div className="rounded bg-white/70 p-3">
                <p className="text-xs text-gray-600">Start Odometer</p>
                <p className="text-lg font-bold text-gray-900">{dutyInProgress.startOdometer} km</p>
              </div>
            </div>
            {dutyInProgress.startLocation && (
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="h-4 w-4" />
                <p className="text-sm">{dutyInProgress.startLocation}</p>
              </div>
            )}
            {onEndDuty && (
              <Button
                onClick={onEndDuty}
                variant="solid"
                className="w-full mt-4"
              >
                <LogOut className="h-4 w-4" />
                End Duty
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-gray-600">No active duty</p>
            {onStartDuty && (
              <Button onClick={onStartDuty} className="w-full">
                Start Duty
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <Zap className="h-4 w-4" />
                <p className="text-xs">Today&apos;s Distance</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalKmToday} km</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Today&apos;s Earnings</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEarnedToday)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="w-full" disabled={!dutyInProgress}>
          View History
        </Button>
        <Button variant="outline" className="w-full">
          Profile
        </Button>
      </div>
    </div>
  );
};

export default DriverDashboard;
