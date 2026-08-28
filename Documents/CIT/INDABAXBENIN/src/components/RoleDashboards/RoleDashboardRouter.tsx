import React from 'react';
import { useEvent } from '../../context/EventContext';
import { OrganizerDashboard } from './OrganizerDashboard';
import { SpeakerDashboard } from './SpeakerDashboard';
import { VolunteerDashboard } from './VolunteerDashboard';
import { AttendeeDashboard } from './AttendeeDashboard';
import { SuperAdminSettings } from '../SuperAdminSettings';
import { RoleAccessPanel } from '../RoleAccessPanel';
import { Eye, ShieldCheck, Sparkles, LifeBuoy, User, Settings, Handshake } from 'lucide-react';
import { ParticipantRole } from '../../types';
import { ROLE_LABELS } from '../../permissions';

const PREVIEW_ROLES: { role: ParticipantRole; icon: typeof ShieldCheck; activeClass: string }[] = [
  { role: 'organizer', icon: ShieldCheck, activeClass: 'bg-amber-500 text-stone-950 shadow-xs' },
  { role: 'speaker', icon: Sparkles, activeClass: 'bg-indigo-600 text-white shadow-xs' },
  { role: 'volunteer', icon: LifeBuoy, activeClass: 'bg-emerald-600 text-white shadow-xs' },
  { role: 'attendee', icon: User, activeClass: 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs' },
  { role: 'sponsor', icon: Handshake, activeClass: 'bg-purple-600 text-white shadow-xs' },
];

/**
 * Affiche le tableau de bord correspondant au role effectif.
 *
 * Le role vient du compte (attribue par l'administrateur) : personne ne peut
 * se l'attribuer soi-meme. Seul un Super-Admin dispose d'une barre de
 * previsualisation, qui n'altere jamais son role reel.
 */
export const RoleDashboardRouter: React.FC = () => {
  const { realRole, effectiveRole, previewRole, setPreviewRole } = useEvent();

  const isSuperAdmin = realRole === 'super-admin';

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

              {PREVIEW_ROLES.map(({ role, icon: Icon, activeClass }) => (
                <button
                  key={role}
                  onClick={() => setPreviewRole(role)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    previewRole === role
                      ? activeClass
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800'
                  }`}
                >
                  <Icon size={14} />
                  <span>{ROLE_LABELS[role]}</span>
                </button>
              ))}
            </div>
          </div>

          {previewRole && (
            <p className="mt-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-900 dark:text-amber-200">
              Vous voyez l&apos;application telle que la verrait un {ROLE_LABELS[previewRole]}. Votre rôle réel reste
              Super-Admin.
            </p>
          )}
        </div>
      )}

      {/* Tableau de bord du role effectif */}
      {effectiveRole === 'super-admin' && (
        <>
          <RoleAccessPanel />
          <SuperAdminSettings />
        </>
      )}
      {effectiveRole === 'organizer' && <OrganizerDashboard />}
      {effectiveRole === 'speaker' && <SpeakerDashboard />}
      {effectiveRole === 'volunteer' && <VolunteerDashboard />}
      {(effectiveRole === 'attendee' || effectiveRole === 'sponsor') && <AttendeeDashboard />}
    </div>
  );
};
