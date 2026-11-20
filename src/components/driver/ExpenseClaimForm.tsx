"use client";

import Image from "next/image";
import { useState } from "react";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { submitExpenseClaimAction, type SubmitExpenseClaimInput } from "@/lib/actions/expense-claim";
import { uploadEvidenceAction } from "@/lib/actions/upload";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import Alert from "@/components/shared/Alert";
import Spinner from "@/components/shared/Spinner";
import { formatCurrency } from "@/lib/formatter";

export interface ExpenseClaim {
  id: string;
  expenseType: "TOLL" | "PARKING" | "OTHER";
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface ExpenseClaimFormProps {
  dutyLogId: string;
  existingClaims?: ExpenseClaim[];
}

const STATUS_LABEL: Record<ExpenseClaim["status"], string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default function ExpenseClaimForm({ dutyLogId, existingClaims = [] }: ExpenseClaimFormProps) {
  const router = useRouter();
  const [localClaims, setLocalClaims] = useState<ExpenseClaim[]>([]);
  const [expenseType, setExpenseType] = useState<SubmitExpenseClaimInput["expenseType"]>("TOLL");
  const [amount, setAmount] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [receiptKey, setReceiptKey] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const claims = [...existingClaims, ...localClaims.filter((local) => !existingClaims.some((server) => server.id === local.id))];

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError("Choose a JPG, PNG, or WebP receipt smaller than 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read this receipt. Choose it again.");
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setPhotoDataUrl(dataUrl);
      setReceiptKey("");
      setPreviewUrl(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1_000_000) return setError("Enter an amount between ৳0.01 and ৳1,000,000.");
    if (!photoDataUrl && !receiptKey) return setError("Add a receipt photo before submitting.");

    setIsLoading(true);
    let storedReceiptKey = receiptKey;
    if (!storedReceiptKey) {
      const upload = await uploadEvidenceAction({ dataUrl: photoDataUrl, kind: "expense-receipt", dutyLogId });
      if (!upload.success) {
        setIsLoading(false);
        setError(upload.error);
        return;
      }
      storedReceiptKey = upload.data.objectKey;
      setReceiptKey(storedReceiptKey);
    }
    const response = await submitExpenseClaimAction({
      dutyLogId,
      expenseType,
      amount: numericAmount,
      receiptImg: storedReceiptKey,
    });
    setIsLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }

    setLocalClaims((current) => [...current, { id: response.data.claimId, expenseType, amount: numericAmount, status: "PENDING" }]);
    setAmount("");
    setPhotoDataUrl("");
    setReceiptKey("");
    setPreviewUrl("");
    setSuccess("Receipt submitted and awaiting review.");
    router.refresh();
  };

  const totalPending = claims.filter((claim) => claim.status === "PENDING").reduce((sum, claim) => sum + claim.amount, 0);

  return (
    <div id="expenses" className="space-y-4">
      <Card>
        <CardHeader><h3 className="text-lg font-bold">Add a toll or parking claim</h3><p className="mt-1 text-sm text-slate-600">Receipts are stored privately and reviewed before being added to the duty total.</p></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="error" title="Could not submit claim">{error}</Alert>}
            {success && <Alert variant="success" title="Claim submitted">{success}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1"><label htmlFor="expense-type" className="text-sm font-medium text-slate-900">Expense type</label><select id="expense-type" value={expenseType} onChange={(event) => setExpenseType(event.target.value as SubmitExpenseClaimInput["expenseType"])} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"><option value="TOLL">Toll</option><option value="PARKING">Parking</option><option value="OTHER">Other (subject to contract)</option></select></div>
              <Input label="Amount (BDT)" type="number" inputMode="decimal" min={0.01} max={1_000_000} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="receipt-photo" className="mb-2 block text-sm font-medium text-slate-900">Receipt photo</label>
              <input id="receipt-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePhotoChange} className="sr-only" required />
              <label htmlFor="receipt-photo" className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-5 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-600">{previewUrl ? <Image src={previewUrl} alt="Receipt preview" width={640} height={360} unoptimized className="max-h-32 w-auto rounded object-contain" /> : <span className="flex items-center gap-2 text-sm text-slate-600"><Camera className="h-5 w-5" /> Add receipt photo</span>}</label>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">{isLoading ? <><Spinner size="sm" /> Uploading…</> : "Submit claim for review"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Claims for this duty</h3>{totalPending > 0 && <span className="text-xs font-medium text-amber-700">{formatCurrency(totalPending)} awaiting review</span>}</div></CardHeader>
        <CardContent>
          {claims.length === 0 ? <p className="text-sm text-slate-500">No expense claims submitted for this duty.</p> : <ul className="divide-y divide-slate-100">{claims.map((claim) => <li key={claim.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium text-slate-900">{claim.expenseType.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{STATUS_LABEL[claim.status]}</p></div><span className="font-semibold text-slate-900">{formatCurrency(claim.amount)}</span></li>)}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}
