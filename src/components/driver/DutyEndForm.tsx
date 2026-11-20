"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Camera } from "lucide-react";
import { endDutyAction } from "@/lib/actions/duty-log";
import { uploadEvidenceAction } from "@/lib/actions/upload";
import Input, { TextArea } from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import Alert from "@/components/shared/Alert";
import Spinner from "@/components/shared/Spinner";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import { formatCurrency, formatDateTime } from "@/lib/formatter";

export interface DutyEndFormProps {
  dutyLogId: string;
  startOdometer: number;
  startTime: Date;
  driverName: string;
}

export default function DutyEndForm({ dutyLogId, startOdometer, startTime, driverName }: DutyEndFormProps) {
  const router = useRouter();
  const [endOdometer, setEndOdometer] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [routeNotes, setRouteNotes] = useState("");
  const [lunchClaimed, setLunchClaimed] = useState(false);
  const [isOutsideDhakaTour, setIsOutsideDhakaTour] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState<{ totalDailyBill: number; warnings: string[] } | null>(null);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError("Choose a JPG, PNG, or WebP image smaller than 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read this image. Choose it again.");
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(dataUrl);
      setPhotoKey("");
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const reading = Number(endOdometer);
    if (!Number.isFinite(reading) || reading < 0 || reading > 999_999) return setError("Enter an odometer reading from 0 to 999,999 km.");
    if (!photoDataUrl && !photoKey) return setError("Take a clear ending odometer photo.");
    if (routeNotes.trim().length === 0) return setError("Please note where the car traveled.");

    setIsLoading(true);
    let storedPhotoKey = photoKey;
    if (!storedPhotoKey) {
      const upload = await uploadEvidenceAction({ dataUrl: photoDataUrl, kind: "end-odometer", dutyLogId });
      if (!upload.success) {
        setIsLoading(false);
        setError(upload.error);
        return;
      }
      storedPhotoKey = upload.data.objectKey;
      setPhotoKey(storedPhotoKey);
    }

    const response = await endDutyAction({
      dutyLogId,
      endOdometer: reading,
      endOdometerImg: storedPhotoKey,
      endLocation: endLocation || undefined,
      routeNotes: routeNotes.trim(),
      lunchClaimed,
      isOutsideDhakaTour,
    });
    setIsLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setSubmitted({ totalDailyBill: response.data.totalDailyBill, warnings: response.data.warnings });
  };

  if (submitted) {
    return (
      <Card className="border-2 border-emerald-200 bg-emerald-50">
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="text-4xl font-bold text-emerald-700" aria-hidden="true">✓</div>
          <h2 className="text-2xl font-bold text-slate-900">Duty submitted</h2>
          <p className="text-slate-600">Thank you, {driverName}. The record is awaiting authorized review.</p>
          <div className="rounded-xl bg-white p-4"><p className="text-sm text-slate-600">Submitted amount</p><p className="text-2xl font-bold text-emerald-700">{formatCurrency(submitted.totalDailyBill)}</p></div>
          {submitted.warnings.length > 0 && <Alert variant="warning" title="Review requested"><ul className="list-disc space-y-1 pl-5 text-left">{submitted.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></Alert>}
          <Button type="button" className="w-full" onClick={() => { router.replace("/go"); router.refresh(); }}>Return to my duties</Button>
        </CardContent>
      </Card>
    );
  }

  const totalKm = Number(endOdometer) - startOdometer;
  return (
    <Card>
      <CardHeader><h2 className="text-xl font-bold">End duty</h2><p className="mt-1 text-sm text-slate-600">Driver: {driverName} · Started {formatDateTime(startTime)}</p></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error" title="Could not submit duty">{error}</Alert>}
          <Input label="Ending odometer (km)" type="number" inputMode="decimal" min={0} max={999999} step="0.1" value={endOdometer} onChange={(event) => setEndOdometer(event.target.value)} required />
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="mb-2 flex items-center gap-2"><AlertCircle className="h-5 w-5 text-sky-700" /><p className="font-semibold text-sky-900">Distance summary</p></div>
            <div className="grid grid-cols-2 gap-3 text-sm"><p className="text-sky-800">Start: {startOdometer} km</p><p className="text-sky-800">End: {endOdometer || "—"} km</p></div>
            <p className={`mt-2 text-lg font-bold ${totalKm < 0 ? "text-rose-700" : "text-sky-900"}`}>{Number.isFinite(totalKm) ? totalKm.toFixed(1) : "—"} km</p>
            {totalKm < 0 && <p className="text-sm text-rose-700">This rollback will be flagged for review.</p>}
          </div>
          <div>
            <label htmlFor="end-photo" className="mb-2 block text-sm font-medium text-slate-900">Ending odometer photo</label>
            <input id="end-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhotoChange} className="sr-only" required />
            <label htmlFor="end-photo" className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-5 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-600">
              {photoPreview ? <Image src={photoPreview} alt="Ending odometer preview" width={640} height={360} unoptimized className="max-h-36 w-auto rounded object-contain" /> : <span className="flex items-center gap-2 text-sm text-slate-600"><Camera className="h-5 w-5" /> Take photo</span>}
            </label>
          </div>
          <Input label="End location (optional)" type="text" maxLength={160} placeholder="e.g. Gulshan office" value={endLocation} onChange={(event) => setEndLocation(event.target.value)} />
          <TextArea label="Route notes" maxLength={1500} rows={3} placeholder="Describe the route and stops." value={routeNotes} onChange={(event) => setRouteNotes(event.target.value)} required />
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={lunchClaimed} onChange={(event) => setLunchClaimed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" /><span>Claim lunch allowance. It will be reviewed before approval.</span></label>
            <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={isOutsideDhakaTour} onChange={(event) => setIsOutsideDhakaTour(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" /><span>Claim an outside-Dhaka tour allowance. It will be reviewed before approval.</span></label>
            <p className="text-xs text-slate-500">Friday overtime is derived from Dhaka time. Government holidays are not driver-selectable; an admin-maintained holiday calendar is still required.</p>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">{isLoading ? <><Spinner size="sm" /> Submitting…</> : "Submit duty for review"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
