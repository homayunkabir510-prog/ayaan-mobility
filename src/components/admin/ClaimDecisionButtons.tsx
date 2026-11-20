"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewExpenseClaimAction } from "@/lib/actions/expense-claim";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import Alert from "@/components/shared/Alert";

export default function ClaimDecisionButtons({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    setLoading(true);
    setError(null);
    const result = await reviewExpenseClaimAction({ claimId, decision, note: note.trim() || undefined });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {error && <Alert variant="error" title="Claim review not saved">{error}</Alert>}
      <Input label="Note (required to reject)" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
      <div className="flex gap-2"><Button type="button" size="sm" disabled={loading} onClick={() => void decide("APPROVED")}>Approve claim</Button><Button type="button" size="sm" variant="destructive" disabled={loading || note.trim().length < 3} onClick={() => void decide("REJECTED")}>Reject</Button></div>
    </div>
  );
}
