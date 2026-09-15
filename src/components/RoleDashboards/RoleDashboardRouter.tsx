import React from 'react';
import { useEvent } from '../../context/EventContext';
import { OrganizerDashboard } from './OrganizerDashboard';
import { SpeakerDashboard } from './SpeakerDashboard';
import { VolunteerDashboard } from './VolunteerDashboard';
import { AttendeeDashboard } from './AttendeeDashboard';
import { SuperAdminSettings } from '../SuperAdminSettings';
import { RoleAccessPanel } from '../RoleAccessPanel';
import { Eye, ShieldCheck, Sparkles, LifeBuoy, User, Settings, Handshake } from 'lucide-react';
import { DashboardKind } from '../../types';
import { labelForRole, roleFor, getActiveRoles } from '../../permissions';
import { classesActives } from '../../roleAccents';

/**
 * Icone associee a chaque forme d'espace.
 *
 * Elle suit l'espace et non le role : un role cree pour l'occasion herite ainsi
 * de l'icone de l'espace qu'il reutilise, sans que personne ait a en choisir
 * une.
 */
const ICONE_PAR_ESPACE: Record<DashboardKind, typeof ShieldCheck> = {
  admin: Settings,
  organizer: ShieldCheck,
  speaker: Sparkles,
  volunteer: LifeBuoy,
  attendee: User,
};

/**
 * Affiche le tableau de bord correspondant au role effectif.
 *
 * Le role vient du compte (attribue par l'administrateur) : personne ne peut
 * se l'attribuer soi-meme. Seul un Super-Admin dispose d'une barre de
 * previsualisation, qui n'altere jamais son role reel.
 */
export const RoleDashboardRouter: React.FC = () => {
  const { realRole, effectiveRole, previewRole, setPreviewRole } = useEvent();

  // La barre de previsualisation appartient a qui attribue les roles, ce qui
  // reste vrai si l'evenement renomme ce role ou en cree un autre aussi large.
  const isSuperAdmin = roleFor(realRole).canManageRoles;
  const espace = roleFor(effectiveRole).dashboard;

  return (
    <div className="space-y-4">
      {/* Barre de previsualisation : Super-Admin uniquement */}
      {isSuperAdmin && (
        <div className="max-w-7xl mx-auto pt-1">
          <div className="bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200 dark:border-stone-800 p-2 rounded-2xl flex items-center justify-between flex-wrap gap-2 shadow-2xs transition-colors">
            <div className="flex items-center gap-2 px-2 text-xs font-bold text-stone-600 dark:text-stone-300">
              <Eye className="w-4 h-4 text-amber-500" />
              <span>Prévisualiser une interface :</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setPreviewRole(null)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  previewRole === null
                    ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800'
                }`}
              >
                <Settings size={14} className={previewRole === null ? 'animate-spin' : ''} />
                <span>Mon rôle (Super-Admin)</span>
              </button>

              {/*
                * Tous les roles de l'evenement sauf le sien : previsualiser
                * son propre role n'apprendrait rien, et le bouton « Mon role »
                * ci-dessus y ramene deja.
                */}
              {getActiveRoles()
                .filter(item => item.id !== realRole)
                .map(item => {
                  const Icon = ICONE_PAR_ESPACE[item.dashboard] || User;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setPreviewRole(item.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        previewRole === item.id
                          ? classesActives(item.id)
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{labelForRole(item.id)}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {previewRole && (
            <p className="mt-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-900 dark:text-amber-200">
              Vous voyez l&apos;application telle que la verrait un {labelForRole(previewRole)}. Votre rôle réel reste
              Super-Admin.
            </p>
          )}
        </div>
      )}

      {/*
        * L'espace affiche depend de la forme choisie pour le role, et non de
        * son identifiant : c'est ce qui permet a un role cree librement d'avoir
        * un espace sans qu'on ecrive un composant pour lui.
        */}
      {espace === 'admin' && (
        <>
          <RoleAccessPanel />
          <SuperAdminSettings />
        </>
      )}
      {espace === 'organizer' && <OrganizerDashboard />}
      {espace === 'speaker' && <SpeakerDashboard />}
      {espace === 'volunteer' && <VolunteerDashboard />}
      {espace === 'attendee' && <AttendeeDashboard />}
    </div>
  );
};
