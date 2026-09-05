"use client";

import { useState } from "react";
import Input, { TextArea } from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import Alert from "@/components/shared/Alert";
import Spinner from "@/components/shared/Spinner";
import Card, { CardContent, CardHeader, CardFooter } from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import { useDutyLogMutation } from "@/hooks/useDutyLogMutation";
import { formatCurrency } from "@/lib/formatter";
import type { EndDutyInput } from "@/lib/actions/duty-log";
import { Camera, AlertCircle } from "lucide-react";

export interface DutyEndFormProps {
  dutyLogId: string;
  startOdometer: number;
  startTime: Date;
  driverName: string;
}

const DutyEndForm = ({ dutyLogId, startOdometer, startTime, driverName }: DutyEndFormProps) => {
  const { submit, isLoading, error, success, data, reset } = useDutyLogMutation();
  const [formData, setFormData] = useState({
    endTime: new Date().toISOString().slice(0, 16),
    endOdometer: startOdometer,
    endOdometerImg: "",
    endLocation: "",
    routeNotes: "",
    lunchClaimed: false,
    isHoliday: false,
    isOutsideDhakaTour: false,
  });
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const totalKm = parseFloat(formData.endOdometer.toString()) - startOdometer;
  const estimatedFuelBill = totalKm * 15; // Rough estimate

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPhotoPreview(dataUrl);
        setFormData((prev) => ({ ...prev, endOdometerImg: dataUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: EndDutyInput = {
      dutyLogId,
      endTime: new Date(formData.endTime),
      endOdometer: parseFloat(formData.endOdometer.toString()),
      endOdometerImg: formData.endOdometerImg,
      endLocation: formData.endLocation || undefined,
      routeNotes: formData.routeNotes,
      lunchClaimed: formData.lunchClaimed,
      isHoliday: formData.isHoliday,
      isOutsideDhakaTour: formData.isOutsideDhakaTour,
    };
    await submit(input);
  };

  if (success && data) {
    return (
      <Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <div className="text-4xl font-bold text-green-600">✓</div>
            <h2 className="text-2xl font-bold text-gray-900">Duty Submitted Successfully!</h2>
            <p className="text-gray-600">Thank you, {driverName}</p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="rounded bg-white p-3">
                <p className="text-xs text-gray-500">Distance</p>
                <p className="text-lg font-bold text-gray-900">{data.totalKm} km</p>
              </div>
              <div className="rounded bg-white p-3">
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-lg font-bold text-gray-900">{data.dutyHours.toFixed(1)}h</p>
              </div>
            </div>

            <div className="rounded bg-white p-4">
              <p className="text-sm text-gray-600">Total Bill</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalDailyBill)}</p>
            </div>

            {data.status === "APPROVED" && (
              <Alert variant="success" title="Auto-Approved">
                Your duty has been automatically approved! The amount will be credited within 24 hours.
              </Alert>
            )}

            {data.status === "PENDING_APPROVAL" && (
              <Alert variant="warning" title="Pending Review">
                Your duty is under admin review. We'll notify you once it's approved.
              </Alert>
            )}

            <Button onClick={() => reset()} className="w-full mt-4">
              Submit Another Duty
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">End Duty</h2>
        <p className="text-sm text-gray-600 mt-1">Driver: {driverName}</p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error" title="Error">{error}</Alert>}

          {/* End Time */}
          <Input
            label="End Time *"
            type="datetime-local"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            required
          />

          {/* Odometer */}
          <Input
            label="End Odometer (km) *"
            type="number"
            step="0.1"
            value={formData.endOdometer}
            onChange={(e) => setFormData({ ...formData, endOdometer: parseFloat(e.target.value) })}
            required
          />

          {/* Distance Summary */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <p className="font-semibold text-blue-900">Distance Summary</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Start: {startOdometer} km</p>
                <p className="text-blue-700">End: {formData.endOdometer} km</p>
              </div>
              <div>
                <p className="font-bold text-blue-900 text-lg">{totalKm} km</p>
                <p className="text-xs text-blue-600">Est. fuel: {formatCurrency(estimatedFuelBill)}</p>
              </div>
            </div>
          </div>

          {/* Odometer Photo */}
          <div>
            <label className="text-sm font-medium text-gray-900 block mb-2">Odometer Photo *</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              required
              className="hidden"
              id="photo-input"
            />
            <label
              htmlFor="photo-input"
              className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              {photoPreview ? (
                <div className="text-center">
                  <img src={photoPreview} alt="Preview" className="max-h-32 mx-auto rounded" />
                  <p className="text-xs text-gray-600 mt-2">Click to change photo</p>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Take Photo</p>
                  <p className="text-xs text-gray-500">of your odometer reading</p>
                </div>
              )}
            </label>
          </div>

          {/* Location */}
          <Input
            label="End Location"
            type="text"
            placeholder="e.g., Gulshan Office"
            value={formData.endLocation}
            onChange={(e) => setFormData({ ...formData, endLocation: e.target.value })}
          />

          {/* Route Notes */}
          <TextArea
            label="Route Notes *"
            placeholder="Describe your route, number of stops, traffic conditions, etc."
            value={formData.routeNotes}
            onChange={(e) => setFormData({ ...formData, routeNotes: e.target.value })}
            rows={3}
            required
          />

          {/* Checkboxes */}
          <div className="space-y-2 border-t border-gray-200 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.lunchClaimed}
                onChange={(e) => setFormData({ ...formData, lunchClaimed: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Claim lunch allowance (৳ 200)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isHoliday}
                onChange={(e) => setFormData({ ...formData, isHoliday: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">This is a holiday/Friday</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isOutsideDhakaTour}
                onChange={(e) => setFormData({ ...formData, isOutsideDhakaTour: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Trip outside Dhaka (tour allowance ৳ 1200)</span>
            </label>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full mt-4">
            {isLoading ? (
              <>
                <Spinner size="sm" /> Submitting...
              </>
            ) : (
              "Submit Duty"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DutyEndForm;
