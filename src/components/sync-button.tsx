"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { syncAd } from "@/lib/actions/settings";
import { Alert, btnPrimary } from "@/components/ui";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btnPrimary}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {pending ? "Synchronisation…" : "Synchroniser l'AD"}
    </button>
  );
}

export function SyncButton() {
  const [state, action] = useActionState(syncAd, null);
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <Button />
      </form>
      {state && (
        <div className="max-w-md">
          <Alert state={state} />
        </div>
      )}
    </div>
  );
}
