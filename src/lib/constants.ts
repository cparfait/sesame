import type {
  AccessStatut,
  AgentStatut,
  RequestStatut,
  RequestType,
  Role,
  TaskStatut,
} from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  VALIDATEUR: "Valideur",
  TECHNICIEN: "Technicien",
  DEMANDEUR: "Demandeur",
  LECTEUR: "Lecteur",
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  CREATION: "Création de compte",
  MODIFICATION: "Modification de compte",
  DEPART: "Départ d'un agent",
};

export const REQUEST_STATUT_LABELS: Record<RequestStatut, string> = {
  BROUILLON: "Brouillon — circuit à lancer",
  EN_VALIDATION: "En validation",
  APPROUVEE: "Approuvée — provisionnement",
  REFUSEE: "Refusée",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export const REQUEST_STATUT_COLORS: Record<RequestStatut, string> = {
  BROUILLON: "bg-slate-100 text-slate-600 ring-slate-500/20",
  EN_VALIDATION: "bg-amber-50 text-amber-700 ring-amber-600/20",
  APPROUVEE: "bg-blue-50 text-blue-700 ring-blue-600/20",
  REFUSEE: "bg-red-50 text-red-700 ring-red-600/20",
  TERMINEE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ANNULEE: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const TASK_STATUT_LABELS: Record<TaskStatut, string> = {
  A_FAIRE: "À faire",
  FAIT: "Fait",
  NON_APPLICABLE: "N/A",
};

export const ACCESS_STATUT_LABELS: Record<AccessStatut, string> = {
  ACTIF: "Actif",
  A_SUPPRIMER: "À supprimer",
  SUPPRIME: "Supprimé",
};

export const ACCESS_STATUT_COLORS: Record<AccessStatut, string> = {
  ACTIF: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  A_SUPPRIMER: "bg-amber-50 text-amber-700 ring-amber-600/20",
  SUPPRIME: "bg-slate-100 text-slate-500 ring-slate-500/20",
};

export const AGENT_STATUT_LABELS: Record<AgentStatut, string> = {
  ACTIF: "En poste",
  PARTI: "Parti",
};

export const CIVILITES = ["Madame", "Monsieur"];

export const STATUTS_EMPLOI = [
  "Fonctionnaire titulaire",
  "Fonctionnaire stagiaire",
  "Contractuel",
  "Vacataire",
  "Apprenti",
  "Stagiaire (école)",
  "Élu",
  "Prestataire",
  "Intérimaire",
  "Saisonnier",
  "Autre",
];

export const TELETRAVAIL_OPTIONS = [
  "1 jour / semaine",
  "2 jours / semaine",
  "3 jours / semaine",
  "Ponctuel",
];

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Libellé de l'objet d'une demande à partir de son payload. */
export function requestObjet(
  type: RequestType,
  payload: unknown,
): string {
  const p = payload as Record<string, unknown>;
  if (type === "CREATION") return `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || "—";
  return String(p.agentNom ?? "—");
}

// ── Circuit de validation (édition au dépôt) ──────────────────────────────

/** Une étape de circuit telle que résolue puis éventuellement éditée au dépôt. */
export type CircuitStepInput = {
  nom: string;
  mode: "SEQUENTIEL" | "PARALLELE";
  requis: number; // nombre de validations requises (mode parallèle)
  validatorRole?: string | null;
  validatorUserIds?: string; // ids utilisateurs séparés par des virgules
};

export const STEP_MODE_LABELS: Record<"SEQUENTIEL" | "PARALLELE", string> = {
  SEQUENTIEL: "Séquentiel (un valideur suffit)",
  PARALLELE: "Parallèle (plusieurs valideurs)",
};

// ── Types des fiches de demande (payload JSON) ────────────────────────────

export type AppDemandee = {
  applicationId: string;
  nom: string;
  profil?: string;
};

export type CreationPayload = {
  civilite?: string;
  nom: string;
  prenom: string;
  matricule?: string;
  email?: string;
  telephone?: string;
  statutEmploi: string;
  direction?: string;
  service?: string;
  fonction?: string;
  site?: string;
  responsable?: string;
  dateArrivee?: string;
  dateFinContrat?: string;
  teletravail?: string; // ex. « 2 jours / semaine » — vide = pas de télétravail
  copieDe?: string; // « créer sur le modèle de l'agent… »
  applications: AppDemandee[];
  equipements: string[];
  commentaire?: string;
};

export type ModificationPayload = {
  agentNom: string;
  champs: Partial<
    Pick<
      CreationPayload,
      | "email"
      | "telephone"
      | "statutEmploi"
      | "direction"
      | "service"
      | "fonction"
      | "site"
      | "responsable"
      | "teletravail"
      | "dateFinContrat"
    >
  >;
  addApplications: AppDemandee[];
  removeAccess: { accessId: string; label: string }[];
  commentaire?: string;
};

export type DepartPayload = {
  agentNom: string;
  dateDepart: string;
  motif?: string;
  accesses: { accessId: string; label: string }[];
  commentaire?: string;
};
