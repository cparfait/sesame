"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { decideAction } from "@/lib/actions/requests";
import { Alert, Card, Field, Textarea, btnDanger, btnPrimary } from "@/components/ui";

function DecisionButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        name="decision"
        value="APPROUVE"
        disabled={pending}
        className={btnPrimary}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Valider l&apos;étape
      </button>
      <button
        type="submit"
        name="decision"
        value="REFUSE"
        disabled={pending}
        className={btnDanger}
      >
        <X className="h-4 w-4" />
        Refuser la demande
      </button>
    </div>
  );
}

export function DecideBox({
  requestId,
  stepNom,
}: {
  requestId: string;
  stepNom: string;
}) {
  const [state, action] = useActionState(decideAction, null);
  return (
    <Card
      title={`Votre décision — ${stepNom}`}
      className="border-amber-300 bg-amber-50/50"
    >
      <form action={action} className="space-y-4">
        <Alert state={state} />
        <input type="hidden" name="requestId" value={requestId} />
        <Field label="Commentaire (obligatoire en cas de refus)">
          <Textarea name="commentaire" placeholder="votre avis…" />
        </Field>
        <DecisionButtons />
      </form>
    </Card>
  );
}
