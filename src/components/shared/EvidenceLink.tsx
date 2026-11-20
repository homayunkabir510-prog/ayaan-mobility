"use client";

import { useState } from "react";
import { getEvidenceSignedUrlAction } from "@/lib/actions/upload";
import Button from "@/components/shared/Button";

export default function EvidenceLink({ path, label = "View private evidence" }: { path: string | null | undefined; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!path) return <span className="text-xs text-slate-400">No evidence attached</span>;

  const loadLink = async () => {
    setLoading(true);
    setError(null);
    const result = await getEvidenceSignedUrlAction({ path });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setUrl(result.data.url);
  };

  return (
    <div className="space-y-1">
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-700 underline">Open secure photo (expires in 5 minutes)</a> : <Button type="button" size="sm" variant="outline" disabled={loading} onClick={loadLink}>{loading ? "Loading…" : label}</Button>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
