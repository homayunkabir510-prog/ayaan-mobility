"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, MapPin, Play } from "lucide-react";
import { startDutyAction } from "@/lib/actions/duty-log";
import { uploadEvidenceAction } from "@/lib/actions/upload";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import Alert from "@/components/shared/Alert";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Spinner from "@/components/shared/Spinner";

export default function StartDutyForm({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [odometer, setOdometer] = useState("");
  const [location, setLocation] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const idempotencyKey = useRef("");

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setPreview(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!photoDataUrl) return setError("Take a clear starting odometer photo.");
    const reading = Number(odometer);
    if (!Number.isFinite(reading) || reading < 0 || reading > 999_999) return setError("Enter an odometer reading from 0 to 999,999 km.");

    setIsLoading(true);
    if (!idempotencyKey.current) idempotencyKey.current = window.crypto.randomUUID();
    const upload = await uploadEvidenceAction({ dataUrl: photoDataUrl, kind: "start-odometer", vehicleId });
    if (!upload.success) {
      setIsLoading(false);
      setError(upload.error);
      return;
    }

    const response = await startDutyAction({
      idempotencyKey: idempotencyKey.current,
      vehicleId,
      startOdometer: reading,
      startOdometerImg: upload.data.objectKey,
      startLocation: location || undefined,
    });
    setIsLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.replace("/go");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Play className="h-5 w-5" /></span>
          <div><h2 className="text-xl font-bold">Start a duty</h2><p className="mt-1 text-sm text-slate-500">Capture the vehicle reading and photo before departure.</p></div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error" title="Could not start duty">{error}</Alert>}
          <Input label="Starting odometer (km)" type="number" inputMode="decimal" min={0} max={999999} step="0.1" value={odometer} onChange={(event) => setOdometer(event.target.value)} required />
          <div>
            <label htmlFor="start-photo" className="mb-2 block text-sm font-medium text-slate-900">Starting odometer photo</label>
            <input id="start-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhoto} className="sr-only" required />
            <label htmlFor="start-photo" className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-5 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-600">
              {preview ? <Image src={preview} alt="Starting odometer preview" width={640} height={360} unoptimized className="max-h-36 w-auto rounded object-contain" /> : <span className="flex items-center gap-2 text-sm text-slate-600"><Camera className="h-5 w-5" /> Take photo</span>}
            </label>
          </div>
          <Input label="Starting location (optional)" type="text" maxLength={160} placeholder="e.g. Banani office" value={location} onChange={(event) => setLocation(event.target.value)} />
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? <><Spinner size="sm" /> Starting…</> : <><MapPin className="h-4 w-4" /> Start duty</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
