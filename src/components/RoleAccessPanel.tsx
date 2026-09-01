import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '../permissions';
import { ParticipantRole, AccountStatus } from '../types';

const ROLE_BADGE_CLASSES: Record<ParticipantRole, string> = {
  'super-admin': 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800',
  organizer: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  speaker: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
  volunteer: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  attendee: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700',
  sponsor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Actif',
  pending: 'En attente',
  suspended: 'Suspendu',
};

/**
 * Attribution des roles par email. Reserve au Super-Admin.
 * C'est ici que l'administrateur decide de la version de l'application
 * que chaque personne obtiendra en se connectant.
 */
export const RoleAccessPanel: React.FC = () => {
  const {
    userAccounts,
    assignRole,
    setAccountStatus,
    resetAccountPassword,
    removeAccount,
    refreshAccounts,
    reloadAccountsFromSheet,
    isSheetsLinked,
    canWriteToSheets,
    sheetsConfig,
    isSyncing,
    authSession,
    setIsSheetsSetupOpen,
  } = useEvent();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ParticipantRole>('all');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<ParticipantRole>('attendee');

  const [isWorking, setIsWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return userAccounts.filter(account => {
      if (roleFilter !== 'all' && account.role !== roleFilter) return false;
      if (!needle) return true;

      return (
        account.email.toLowerCase().includes(needle) ||
        account.name.toLowerCase().includes(needle) ||
        (account.institution || '').toLowerCase().includes(needle)
      );
    });
  }, [userAccounts, search, roleFilter]);

  const roleCounts = useMemo(
    () =>
      userAccounts.reduce<Record<string, number>>((acc, account) => {
        acc[account.role] = (acc[account.role] || 0) + 1;
        return acc;
      }, {}),
    [userAccounts],
  );

  const run = async (action: () => Promise<string>) => {
    setIsWorking(true);
    setFeedback(null);
    try {
      setFeedback({ kind: 'ok', text: await action() });
    } catch (error: any) {
      setFeedback({ kind: 'error', text: error?.message || 'Opération impossible.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleAdd = () =>
    run(async () => {
      const message = await assignRole(newEmail, newRole, {
        name: newName.trim() || undefined,
        status: 'active',
      });

      setNewEmail('');
      setNewName('');
      return message;
    });

  /** Efface le mot de passe : la personne en choisira un nouveau elle-meme. */
  const handleResetPassword = (email: string) => run(() => resetAccountPassword(email));

  const handleRoleChange = (email: string, role: ParticipantRole) =>
    run(() => assignRole(email, role));

  const fieldClass =
    'w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition';

  return (
    <div className="space-y-5">
      {/* En-tete */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-emerald-900 text-white rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-mono uppercase bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full font-bold">
              Super-Admin
            </span>
            <h2 className="font-heading font-black text-2xl mt-2 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
              Rôles &amp; accès
            </h2>
            <p className="text-xs text-stone-300 mt-1.5 max-w-xl leading-relaxed">
              Chaque email reçoit un rôle, et ce rôle détermine l&apos;interface obtenue à la connexion. Le rôle est
              vérifié par le serveur à chaque requête, jamais par le navigateur. La source de vérité est
              l&apos;onglet «&nbsp;{sheetsConfig.profilesTab}&nbsp;» du classeur Google Sheet.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${isSheetsLinked ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="font-bold">{isSheetsLinked ? 'Classeur lié' : 'Base locale'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  run(async () => {
                    if (isSheetsLinked) return reloadAccountsFromSheet();
                    await refreshAccounts();
                    return 'Liste des comptes rechargée depuis le serveur.';
                  })
                }
                disabled={isSyncing || isWorking}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Recharger
              </button>
              <button
                onClick={() => setIsSheetsSetupOpen(true)}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                Configurer
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/10">
          {ASSIGNABLE_ROLES.map(role => (
            <span
              key={role}
              className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold"
            >
              {ROLE_LABELS[role]} : {roleCounts[role] || 0}
            </span>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-in fade-in ${
            feedback.kind === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          {feedback.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {isSheetsLinked && !canWriteToSheets && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl text-[11px] font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          <span>
            Aucune voie d&apos;écriture configurée : les attributions restent dans la table du serveur. Ajoutez une URL
            Apps Script ou les identifiants AppSheet pour qu&apos;elles remontent aussi dans le classeur.
          </span>
        </div>
      )}

      {/* Ajout / mise a jour d'un compte */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 space-y-3">
        <h3 className="text-sm font-heading font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-600" />
          Attribuer un rôle à un email
        </h3>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              value={newEmail}
              onChange={event => setNewEmail(event.target.value)}
              placeholder="email@exemple.bj"
              className={`${fieldClass} pl-9`}
            />
          </div>

          <input
            value={newName}
            onChange={event => setNewName(event.target.value)}
            placeholder="Nom complet (optionnel)"
            className={fieldClass}
          />

          <select
            value={newRole}
            onChange={event => setNewRole(event.target.value as ParticipantRole)}
            className={fieldClass}
          >
            {ASSIGNABLE_ROLES.map(role => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>

        </div>

        <button
          onClick={handleAdd}
          disabled={isWorking || !newEmail.trim()}
          className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Enregistrer l&apos;attribution
        </button>

        <p className="text-[11px] text-stone-500 leading-relaxed">
          Vous désignez un email et un rôle ; la personne choisit elle-même son mot de passe en s&apos;inscrivant
          avec cet email. Vous n&apos;avez donc jamais à en connaître un, ni à en transmettre. Un compte encore à
          activer porte une clé rouge dans la liste ci-dessous.
        </p>
      </div>

      {/* Liste des comptes */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Rechercher un email, un nom, une institution…"
              className={`${fieldClass} pl-9`}
            />
          </div>

          <select
            value={roleFilter}
            onChange={event => setRoleFilter(event.target.value as 'all' | ParticipantRole)}
            className={`${fieldClass} w-auto`}
          >
            <option value="all">Tous les rôles</option>
            {ASSIGNABLE_ROLES.map(role => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>

          <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400 shrink-0">
            {filtered.length} / {userAccounts.length}
          </span>
        </div>

        <div className="divide-y divide-stone-200 dark:divide-stone-800 max-h-[28rem] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-xs text-stone-500 italic">Aucun compte ne correspond à ce filtre.</p>
          )}

          {filtered.map(account => {
            const isMe = authSession?.email === account.email;

            return (
              <div
                key={account.email}
                className="p-3.5 flex flex-wrap items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{account.name}</p>
                    {isMe && (
                      <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                        Moi
                      </span>
                    )}
                    {account.hasPassword ? (
                      <span title="Mot de passe choisi par la personne" className="inline-flex">
                        <KeyRound className="w-3 h-3 text-emerald-600" />
                      </span>
                    ) : (
                      <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">
                        À activer
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 truncate">{account.email}</p>
                  {account.institution && (
                    <p className="text-[10px] text-stone-500 truncate">{account.institution}</p>
                  )}
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${ROLE_BADGE_CLASSES[account.role]}`}
                >
                  {ROLE_LABELS[account.role]}
                </span>

                <select
                  value={account.role}
                  onChange={event => handleRoleChange(account.email, event.target.value as ParticipantRole)}
                  disabled={isWorking}
                  className="px-2.5 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-[11px] font-bold outline-none focus:border-emerald-600 transition cursor-pointer shrink-0"
                >
                  {ASSIGNABLE_ROLES.map(role => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>

                <select
                  value={account.status}
                  onChange={event => run(() => setAccountStatus(account.email, event.target.value as AccountStatus))}
                  disabled={isWorking}
                  className="px-2.5 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-[11px] font-bold outline-none focus:border-emerald-600 transition cursor-pointer shrink-0"
                >
                  {(Object.keys(STATUS_LABELS) as AccountStatus[]).map(status => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Effacer le mot de passe de ${account.email} ? Ses sessions seront fermées, et la personne ` +
                          `devra s'inscrire pour en choisir un nouveau. Vous n'aurez rien à lui transmettre.`,
                      )
                    ) {
                      handleResetPassword(account.email);
                    }
                  }}
                  disabled={isWorking || !account.hasPassword}
                  className="p-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shrink-0"
                  title={
                    account.hasPassword
                      ? 'Effacer le mot de passe (la personne en choisira un nouveau)'
                      : 'Ce compte est déjà à activer'
                  }
                >
                  <KeyRound className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Retirer ${account.email} de la table des comptes ?`)) {
                      run(() => removeAccount(account.email));
                    }
                  }}
                  disabled={isMe || isWorking}
                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shrink-0"
                  title={isMe ? 'Vous ne pouvez pas retirer votre propre compte' : 'Retirer'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
