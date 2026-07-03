"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Undo2, X } from "lucide-react";
import { decideAction } from "@/lib/actions/requests";
import {
  Alert,
  Card,
  Field,
  Select,
  Textarea,
  btnDanger,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";

type PrevStep = { ordre: number; nom: string };

function DecisionButtons({ canSendBack }: { canSendBack: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" name="decision" value="APPROUVE" disabled={pending} className={btnPrimary}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Valider l&apos;étape
      </button>
      <button type="submit" name="decision" value="REFUSE" disabled={pending} className={btnDanger}>
        <X className="h-4 w-4" />
        Refuser la demande
      </button>
      {canSendBack && (
        <button
          type="submit"
          name="decision"
          value="RENVOYE"
          disabled={pending}
          className={btnSecondary}
        >
          <Undo2 className="h-4 w-4" />
          Renvoyer pour correction
        </button>
      )}
    </div>
  );
}

export function DecideBox({
  requestId,
  stepNom,
  previousSteps,
}: {
  requestId: string;
  stepNom: string;
  previousSteps: PrevStep[];
}) {
  const [state, action] = useActionState(decideAction, null);
  const canSendBack = previousSteps.length > 0;
  const [target, setTarget] = useState(
    previousSteps.length > 0 ? String(previousSteps[previousSteps.length - 1].ordre) : "",
  );

  return (
    <Card title={`Votre décision — ${stepNom}`} className="border-amber-300 bg-amber-50/50">
      <form action={action} className="space-y-4">
        <Alert state={state} />
        <input type="hidden" name="requestId" value={requestId} />

        <Field label="Commentaire (obligatoire en cas de refus ou de renvoi)">
          <Textarea name="commentaire" placeholder="votre avis…" />
        </Field>

        {canSendBack && (
          <Field label="En cas de renvoi, revenir à l'étape">
            <Select name="targetOrdre" value={target} onChange={(e) => setTarget(e.target.value)}>
              {previousSteps.map((s) => (
                <option key={s.ordre} value={s.ordre}>
                  {s.ordre}. {s.nom}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <DecisionButtons canSendBack={canSendBack} />
      </form>
    </Card>
  );
}
