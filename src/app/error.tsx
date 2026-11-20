"use client";

import { useEffect } from "react";
import Button from "@/components/shared/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Ayaan Mobility page error", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-950">This page could not be loaded</h1>
      <p className="text-sm text-slate-600">The workspace may be temporarily unavailable. Check the database and storage configuration, then try again.</p>
      <Button type="button" onClick={() => reset()}>Try again</Button>
    </main>
  );
}
