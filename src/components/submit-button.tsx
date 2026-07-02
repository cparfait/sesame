"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { btnPrimary } from "./ui";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  className = btnPrimary,
  formAction,
}: {
  children: ReactNode;
  className?: string;
  formAction?: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" formAction={formAction} disabled={pending} className={className}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
