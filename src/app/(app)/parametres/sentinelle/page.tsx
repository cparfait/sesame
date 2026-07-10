import { redirect } from "next/navigation";

// Le connecteur Sentinelle a été déplacé dans le hub « Connecteurs ».
export default function ParametresSentinelleRedirect() {
  redirect("/parametres/connecteurs");
}
