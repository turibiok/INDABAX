import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Database,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { ROLE_LABELS } from '../permissions';

/**
 * Ecran de connexion : l'utilisateur saisit son email, et le role qui lui a ete
 * attribue par l'administrateur (dans le classeur Google Sheet) determine
 * l'interface qu'il obtient.
 */
export const LoginView: React.FC = () => {
  const {
    signInWithEmail,
    isAuthenticating,
    isSheetsLinked,
    sheetsConfig,
    eventConfig,
    setIsSheetsSetupOpen,
    userAccounts,
  } = useEvent();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await signInWithEmail(email, code || undefined);
    } catch (err: any) {
      const reason = err?.reason;

      if (reason === 'code_required') {
        setNeedsCode(true);
        setError("Ce compte est protégé par un code d'accès. Saisissez-le ci-dessous.");
        return;
      }

      if (reason === 'bad_code') {
        setNeedsCode(true);
        setError("Code d'accès incorrect.");
        return;
      }

      setError(err?.message || 'Connexion impossible.');
    }
  };

  const roleCounts = userAccounts.reduce<Record<string, number>>((acc, account) => {
    acc[account.role] = (acc[account.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col">
      {/* Bandeau evenement */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-amber-600 text-white text-xs font-semibold py-2 px-4 text-center">
        <span className="bg-amber-400 text-stone-950 text-[10px] uppercase font-black px-2 py-0.5 rounded mr-2">
          Événement officiel
        </span>
        {eventConfig.eventName} {eventConfig.edition} • {eventConfig.startDate} → {eventConfig.endDate} • {eventConfig.location}
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 items-stretch">
          {/* Colonne gauche : identite de l'evenement */}
          <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 text-white rounded-3xl p-8 shadow-2xl">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-amber-500 to-orange-500 p-0.5 shadow-lg mb-5">
                <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center">
                  <span className="font-heading font-black text-xl bg-gradient-to-r from-amber-400 to-emerald-400 bg-clip-text text-transparent">
                    IX
                  </span>
                </div>
              </div>

              <h1 className="font-heading font-black text-3xl leading-tight">
                INDABAX <span className="text-amber-400">BÉNIN</span>
              </h1>
              <p className="text-emerald-100 text-sm mt-2 font-medium">
                Deep Learning &amp; IA pour l&apos;Afrique — plateforme inspirée de Baobab.
              </p>

              <p className="text-emerald-200/80 text-xs mt-5 leading-relaxed">
                {eventConfig.themeDescription}
              </p>
            </div>

            <div className="space-y-3 mt-8">
              <div className="flex items-start gap-3 text-xs">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-emerald-100">
                  Votre <strong className="text-white">rôle est attribué par les organisateurs</strong>. L&apos;interface
                  s&apos;adapte automatiquement : participant, conférencier, volontaire, organisateur ou administrateur.
                </p>
              </div>
              <div className="flex items-start gap-3 text-xs">
                <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-emerald-100">
                  Les comptes vivent dans un <strong className="text-white">classeur Google Sheet</strong> (base AppSheet)
                  partagé par lien. Aucun mot de passe à créer.
                </p>
              </div>
            </div>
          </div>

          {/* Colonne droite : formulaire */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-center">
            <div className="md:hidden mb-6 text-center">
              <h1 className="font-heading font-black text-2xl">
                INDABAX <span className="text-amber-600">BÉNIN</span>
              </h1>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Connectez-vous avec l&apos;email de votre inscription.
              </p>
            </div>

            <div className="mb-6">
              <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-full font-bold">
                Accès participant
              </span>
              <h2 className="font-heading font-black text-2xl mt-3">Connexion</h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                Saisissez l&apos;adresse email utilisée lors de votre inscription. Nous y retrouvons le rôle que
                l&apos;organisation vous a assigné.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5"
                >
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="prenom.nom@exemple.bj"
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-2xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition"
                  />
                </div>
              </div>

              {needsCode && (
                <div className="animate-in fade-in slide-in-from-top-1">
                  <label
                    htmlFor="login-code"
                    className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block mb-1.5"
                  >
                    Code d&apos;accès
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-code"
                      type="password"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={event => setCode(event.target.value)}
                      placeholder="Code transmis par les organisateurs"
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-2xl text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating || !email.trim()}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-800/20 transition-all active:scale-98 cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vérification du compte…
                  </>
                ) : (
                  <>
                    Accéder à mon espace
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Etat de la base de donnees */}
            <div className="mt-6 pt-5 border-t border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`w-2 h-2 rounded-full ${isSheetsLinked ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  <span className="font-bold text-stone-700 dark:text-stone-300">
                    {isSheetsLinked
                      ? `Base liée • onglet « ${sheetsConfig.usersTab} »`
                      : 'Base locale (aucun classeur lié)'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSheetsSetupOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Database className="w-3.5 h-3.5" />
                  Configurer
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                {Object.entries(roleCounts).length === 0 ? (
                  <span className="text-[11px] text-stone-500">Aucun compte enregistré.</span>
                ) : (
                  Object.entries(roleCounts).map(([role, count]) => (
                    <span
                      key={role}
                      className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full font-bold"
                    >
                      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role} : {count}
                    </span>
                  ))
                )}
              </div>

              <p className="text-[11px] text-stone-500 dark:text-stone-500 flex items-start gap-1.5 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
                Email non reconnu ? Écrivez à{' '}
                <a
                  href={`mailto:${eventConfig.contactEmail}`}
                  className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                >
                  {eventConfig.contactEmail}
                </a>{' '}
                pour être ajouté à la base des comptes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
