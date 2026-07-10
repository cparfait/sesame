import type {
  AccessStatut,
  AgentStatut,
  AppFonction,
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

/**
 * Fonctions « système » d'application : besoins transverses des demandes reliés
 * à l'application concrète qui les assure. `description` explicite l'effet sur
 * la checklist de provisionnement.
 */
export const APP_FONCTION_LABELS: Record<AppFonction, string> = {
  MESSAGERIE: "Messagerie (boîte mail)",
  TELEPHONIE: "Téléphonie / VPN (télétravail)",
  COMPTE_AD: "Compte AD / annuaire",
  CONTROLE_ACCES: "Badge / contrôle d'accès",
  PARC: "Parc / matériel (GLPI…)",
  POSTE: "Antivirus / MDM / poste",
};

export const APP_FONCTION_HINTS: Record<AppFonction, string> = {
  MESSAGERIE:
    "Les tâches « créer / couper la boîte mail » seront rattachées à cette application.",
  TELEPHONIE:
    "Les tâches d'accès télétravail (VPN, MFA) seront rattachées à cette application.",
  COMPTE_AD:
    "Les tâches de compte AD (création, mise à jour, désactivation) seront rattachées à cette application.",
  CONTROLE_ACCES:
    "Une tâche « badge / accès aux locaux » sera ajoutée (création) et « désactiver le badge » (départ), rattachée à cette application.",
  PARC:
    "Une tâche « enregistrer / sortir le matériel du parc » sera ajoutée, rattachée à cette application.",
  POSTE:
    "Une tâche « inscrire / retirer le poste (antivirus, MDM) » sera ajoutée, rattachée à cette application.",
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

// Seuil d'inactivité par défaut de l'annuaire (jours) quand non configuré.
export const DEFAULT_INACTIVE_DAYS = 90;

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

/**
 * Ancienneté approximative d'une date passée : « il y a ~3 mois ». Le « ~ »
 * signale l'imprécision — pensé pour lastLogonTimestamp AD (flou de ~14 jours).
 * Null = « jamais » (aucune connexion enregistrée).
 */
export function fmtAge(d: Date | string | null | undefined): string {
  if (!d) return "jamais";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ~${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ~${months} mois`;
  const years = Math.floor(days / 365);
  const rem = Math.floor((days - years * 365) / 30);
  const y = `${years} an${years > 1 ? "s" : ""}`;
  return rem > 0 ? `il y a ~${y} ${rem} mois` : `il y a ~${y}`;
}

/**
 * Un compte est « inactif » si sa dernière connexion remonte à plus de `days`
 * jours — ou s'il ne s'est jamais connecté (`null`). Isolé ici (plutôt qu'inline
 * dans un composant) car la lecture de l'horloge est impure au sens du rendu.
 */
export function isInactiveSince(
  d: Date | string | null | undefined,
  days: number,
): boolean {
  if (!d) return true;
  return (Date.now() - new Date(d).getTime()) / 86_400_000 > days;
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
