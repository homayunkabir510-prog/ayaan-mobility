"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveDutyLogAction, rejectDutyLogAction } from "@/lib/actions/duty-log";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import Alert from "@/components/shared/Alert";

export default function AdminDecisionButtons({ dutyLogId, blocked = false }: { dutyLogId: string; blocked?: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const act = async (decision: "approve" | "reject") => {
    setError(null);
    setLoading(true);
    const result = decision === "approve"
      ? await approveDutyLogAction(dutyLogId)
      : await rejectDutyLogAction(dutyLogId, reason);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {blocked && <Alert variant="warning" title="Resolve claims first">Approve or reject every pending expense claim before deciding this duty.</Alert>}
      {error && <Alert variant="error" title="Review not saved">{error}</Alert>}
      <Button type="button" disabled={loading || blocked} onClick={() => void act("approve")} className="w-full">{loading ? "Saving…" : "Approve duty"}</Button>
      <Input label="Reason (required for rejection)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
      <Button type="button" variant="destructive" disabled={loading || blocked || reason.trim().length < 3} onClick={() => void act("reject")} className="w-full">Reject duty</Button>
    </div>
  );
}
