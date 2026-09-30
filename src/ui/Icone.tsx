import type { ReactNode } from 'react'

/**
 * Petites icones de navigation, dessinees en traits.
 * Elles sont inline : aucune police d'icones a telecharger, donc rien a
 * attendre au lancement et un affichage identique hors ligne.
 */
const DEFAUT: ReactNode = <circle cx="12" cy="12" r="8" />

const DESSINS: Record<string, ReactNode> = {
  aujourdhui: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="M9 15l2 2 4-4" />
    </>
  ),
  planning: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M9 9v12M15 9v12" />
    </>
  ),
  besoin: (
    <>
      <path d="M4 3v16a2 2 0 0 0 2 2h15" />
      <path d="M8 16v-4M12 16V8M16 16v-6M20 16v-9" />
    </>
  ),
  equipe: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.6a3.4 3.4 0 0 1 0 5.6M18 14.6A6 6 0 0 1 21 20" />
    </>
  ),
  alertes: (
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </>
  ),
  heures: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  conges: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  competences: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.4 13.4L7 22l5-2.6L17 22l-1.4-8.6" />
    </>
  ),
  pilotage: (
    <>
      <path d="M3.5 18a9 9 0 1 1 17 0" />
      <path d="M12 18l4.2-5.2" />
    </>
  ),
  parametres: (
    <>
      <path d="M3 7h12M19 7h2M3 17h4M11 17h10" />
      <circle cx="17" cy="7" r="2.4" />
      <circle cx="9" cy="17" r="2.4" />
    </>
  ),
}

export function Icone({ nom }: { readonly nom: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DESSINS[nom] ?? DEFAUT}
    </svg>
  )
}
