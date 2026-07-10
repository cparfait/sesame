"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteRequest } from "@/lib/actions/requests";
import { btnDanger } from "@/components/ui";

/** Suppression définitive d'une demande (réservé aux administrateurs). */
export function DeleteRequestButton({
  requestId,
  numero,
}: {
  requestId: string;
  numero: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    if (
      !window.confirm(
        `Supprimer définitivement la demande n° ${numero} ? Cette action est irréversible et efface aussi ses validations et tâches.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteRequest(requestId);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      router.push("/demandes");
    });
  };

  return (
    <button type="button" onClick={onClick} disabled={pending} className={btnDanger}>
      <Trash2 className="h-4 w-4" /> {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}
