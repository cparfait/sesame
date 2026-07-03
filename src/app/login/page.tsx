import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <KeyRound className="h-6 w-6" />
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Sésame</h1>
            <p className="mt-1 text-sm text-slate-500">
              Comptes & habilitations de la collectivité
            </p>
          </div>
        </div>
        {error === "magic" && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
            Ce lien de connexion est invalide ou expiré. Connectez-vous ci-dessous.
          </p>
        )}
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-400">
          Connectez-vous avec votre identifiant Windows habituel.
        </p>
      </div>
    </main>
  );
}
